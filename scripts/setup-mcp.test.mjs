// Tests for scripts/setup-mcp.mjs. Zero dependencies: `node --test 'scripts/**/*.test.mjs'`.
//
// The first block pins what the script wrote before the refactor into one writer per client
// (characterization). It may change only where a change is intended.

import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'setup-mcp.mjs');
const { MCP_HOST: HOST, AGENT_API_DOCS, STAGE } = await import('./setup-mcp/catalog.mjs');

/** Run the script in a fresh project dir (and a fresh HOME); returns { dir, home, out }. */
function run(args, { dir = mkdtempSync(join(tmpdir(), 'setup-mcp-')), env = {} } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const out = execFileSync(process.execPath, [script, '--project', dir, ...args], {
    env: { PATH: process.env.PATH, HOME: home, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { dir, home, out };
}

/** Like `run`, but also returns stderr (needs spawnSync). */
function runAll(args, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const result = spawnSync(process.execPath, [script, '--project', dir, ...args], {
    env: { PATH: process.env.PATH, HOME: home, ...env },
    encoding: 'utf8',
  });
  return { dir, home, out: result.stdout, stderr: result.stderr, status: result.status };
}

const read = (...parts) => readFileSync(join(...parts), 'utf8');
const json = (...parts) => JSON.parse(read(...parts));

const envServers = (withType) => {
  const type = withType ? { type: 'http' } : {};
  const auth = 'Bearer ${env:LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN}';
  return {
    'leanscope-admin': { ...type, url: `${HOST}/mcp/admin`, headers: { Authorization: auth } },
    'leanscope-graphql': { ...type, url: `${HOST}/mcp/graphql-v2`, headers: { Authorization: auth } },
    'leanscope-agents': {
      ...type,
      url: `${HOST}/mcp/agents`,
      headers: {
        Authorization: auth,
        'X-LeanScope-Key-OpenAI': '${env:LEANSCOPE_OPENAI_API_KEY}',
        'X-LeanScope-Key-Anthropic': '${env:LEANSCOPE_ANTHROPIC_API_KEY}',
        'X-LeanScope-Key-Mistral': '${env:LEANSCOPE_MISTRAL_API_KEY}',
        'X-LeanScope-Key-ElevenLabs': '${env:LEANSCOPE_ELEVENLABS_API_KEY}',
        'X-LeanScope-Key-TypeSafe': '${env:LEANSCOPE_TYPESAFE_API_KEY}',
      },
    },
  };
};

const CODEX_BLOCK = `# >>> leanscope agent-kit (managed by scripts/setup-mcp.mjs) >>>
[mcp_servers.leanscope-admin]
url = "${HOST}/mcp/admin"
bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"

[mcp_servers.leanscope-graphql]
url = "${HOST}/mcp/graphql-v2"
bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"

[mcp_servers.leanscope-agents]
url = "${HOST}/mcp/agents"
bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"
env_http_headers = { "X-LeanScope-Key-OpenAI" = "LEANSCOPE_OPENAI_API_KEY", "X-LeanScope-Key-Anthropic" = "LEANSCOPE_ANTHROPIC_API_KEY", "X-LeanScope-Key-Mistral" = "LEANSCOPE_MISTRAL_API_KEY", "X-LeanScope-Key-ElevenLabs" = "LEANSCOPE_ELEVENLABS_API_KEY", "X-LeanScope-Key-TypeSafe" = "LEANSCOPE_TYPESAFE_API_KEY" }
# <<< leanscope agent-kit <<<`;

// --- characterization -----------------------------------------------------------------------

test('vscode with env secrets: ${env:…} references, type http', () => {
  const { dir } = run(['--vendors', 'vscode', '--secrets', 'env']);
  assert.deepEqual(json(dir, '.vscode', 'mcp.json'), { servers: envServers(true) });
});

test('cursor: ${env:…} references, no type', () => {
  const { dir } = run(['--vendors', 'cursor']);
  assert.deepEqual(json(dir, '.cursor', 'mcp.json'), { mcpServers: envServers(false) });
});

test('codex: one managed block in .codex/config.toml', () => {
  const { dir } = run(['--vendors', 'codex']);
  assert.equal(read(dir, '.codex', 'config.toml'), `${CODEX_BLOCK}\n`);
});

test('json clients keep servers and keys that are not ours', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  mkdirSync(join(dir, '.cursor'));
  writeFileSync(
    join(dir, '.cursor', 'mcp.json'),
    JSON.stringify({ other: 1, mcpServers: { mine: { url: 'x' } } }),
  );
  run(['--vendors', 'cursor'], { dir });
  const config = json(dir, '.cursor', 'mcp.json');
  assert.equal(config.other, 1);
  assert.deepEqual(config.mcpServers.mine, { url: 'x' });
  assert.ok(config.mcpServers['leanscope-agents']);
});

test('codex replaces only its own block', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  mkdirSync(join(dir, '.codex'));
  const before = 'model = "o3"\n';
  const after = '\n[mcp_servers.mine]\nurl = "x"\n';
  writeFileSync(join(dir, '.codex', 'config.toml'), `${before}\n# >>> leanscope agent-kit (managed by scripts/setup-mcp.mjs) >>>\nold\n# <<< leanscope agent-kit <<<${after}`);
  run(['--vendors', 'codex'], { dir });
  assert.equal(read(dir, '.codex', 'config.toml'), `${before}\n${CODEX_BLOCK}${after}`);
});

// --- vscode prompts for secrets (intended change: the default was env) ------------------------

test('vscode by default prompts for the token and the OpenAI key only', () => {
  const { dir } = run(['--clients', 'vscode']);
  const config = json(dir, '.vscode', 'mcp.json');
  assert.deepEqual(
    config.inputs.map((i) => [i.id, i.type, i.password]),
    [
      ['leanscope-token', 'promptString', true],
      ['leanscope-openai', 'promptString', true],
    ],
  );
  assert.deepEqual(config.servers['leanscope-agents'].headers, {
    Authorization: 'Bearer ${input:leanscope-token}',
    'X-LeanScope-Key-OpenAI': '${input:leanscope-openai}',
  });
  assert.equal(config.servers['leanscope-admin'].url, `${HOST}/mcp/admin`);
  assert.doesNotMatch(read(dir, '.vscode', 'mcp.json'), /\$\{env:/);
});

test('vscode --keys picks the prompted LLM keys', () => {
  const { dir } = run(['--clients', 'vscode', '--keys', 'anthropic,mistral']);
  const config = json(dir, '.vscode', 'mcp.json');
  assert.deepEqual(
    config.inputs.map((i) => i.id),
    ['leanscope-token', 'leanscope-anthropic', 'leanscope-mistral'],
  );
});

test('vscode switching to env drops our inputs and keeps everyone else’s', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  mkdirSync(join(dir, '.vscode'));
  writeFileSync(
    join(dir, '.vscode', 'mcp.json'),
    JSON.stringify({ inputs: [{ type: 'promptString', id: 'other' }], servers: {} }),
  );
  run(['--clients', 'vscode'], { dir });
  assert.equal(json(dir, '.vscode', 'mcp.json').inputs.length, 3);
  run(['--clients', 'vscode', '--secrets', 'env'], { dir });
  assert.deepEqual(json(dir, '.vscode', 'mcp.json').inputs, [{ type: 'promptString', id: 'other' }]);
});

// --- copilot-cli -------------------------------------------------------------------------------

test('copilot-cli writes the user-level config with ${VAR} headers and keeps other servers', () => {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  mkdirSync(join(home, '.copilot'));
  writeFileSync(
    join(home, '.copilot', 'mcp-config.json'),
    JSON.stringify({ mcpServers: { 'open-knowledge': { command: 'ok' } } }),
  );
  runAll(['--clients', 'copilot-cli'], { COPILOT_HOME: join(home, '.copilot') });
  const { mcpServers } = json(home, '.copilot', 'mcp-config.json');
  assert.deepEqual(mcpServers['open-knowledge'], { command: 'ok' });
  assert.deepEqual(mcpServers['leanscope-graphql'], {
    type: 'http',
    url: `${HOST}/mcp/graphql-v2`,
    headers: { Authorization: 'Bearer ${LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN}' },
    tools: ['*'],
  });
  assert.equal(
    mcpServers['leanscope-agents'].headers['X-LeanScope-Key-OpenAI'],
    '${LEANSCOPE_OPENAI_API_KEY:-}',
  );
});

// --- claude-code -------------------------------------------------------------------------------

test('claude-code enables the kit plugin in .claude/settings.json and keeps other settings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(
    join(dir, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { allow: ['x'] }, enabledPlugins: { 'other@m': false } }),
  );
  const { out } = run(['--clients', 'claude-code'], { dir });
  const settings = json(dir, '.claude', 'settings.json');
  assert.deepEqual(settings.permissions, { allow: ['x'] });
  assert.deepEqual(settings.enabledPlugins, { 'other@m': false, 'leanscope-agent-kit@leanscope': true });
  assert.deepEqual(settings.extraKnownMarketplaces, {
    leanscope: { source: { source: 'github', repo: 'leanscope/leanscope-agent-kit' } },
  });
  assert.doesNotMatch(read(dir, '.claude', 'settings.json'), /TOKEN|API_KEY/);
  assert.match(out, /\/plugin configure leanscope-agent-kit@leanscope/);
});

test('claude-code migrates the pre-0.4.2 plugin id and the old repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(
    join(dir, '.claude', 'settings.json'),
    JSON.stringify({
      extraKnownMarketplaces: { leanscope: { source: { source: 'github', repo: 'leanscope/agent-kit' } } },
      enabledPlugins: { 'agent-kit@leanscope': true },
    }),
  );
  run(['--clients', 'claude-code'], { dir });
  const settings = json(dir, '.claude', 'settings.json');
  assert.deepEqual(settings.enabledPlugins, { 'leanscope-agent-kit@leanscope': true });
  assert.deepEqual(settings.extraKnownMarketplaces, {
    leanscope: { source: { source: 'github', repo: 'leanscope/leanscope-agent-kit' } },
  });
});

test('vscode promises the masked prompt for Local sessions only, and sends Copilot sessions to copilot-cli', () => {
  const { out } = run(['--clients', 'vscode']);
  assert.match(out, /This covers Local sessions only/);
  assert.match(out, /Copilot sessions \(Session Target "Copilot"\) and Copilot CLI never show this prompt/);
  assert.match(out, /they need --clients copilot-cli/);
});

test('copilot-cli (Copilot CLI and VS Code Copilot sessions) promises no prompt and says how to reload', () => {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const { out } = runAll(['--clients', 'copilot-cli'], { COPILOT_HOME: home });
  assert.doesNotMatch(out, /masked|asks for/i);
  assert.match(out, /there is no input prompt/);
  assert.match(out, /start it from a new terminal \(`code \.`\), then open a new Copilot session/);
  const text = read(home, 'mcp-config.json');
  assert.doesNotMatch(text, /\$\{input:|\$\{env:/); // the portable format resolves neither
  assert.ok(JSON.parse(text).mcpServers, 'portable format uses mcpServers, not servers');
});

// --- variable names: exactly the ones in .env.example --------------------------------------------

const kit = join(here, '..');
const ENV_NAMES = [...read(kit, '.env.example').matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);

test('.env.example and the catalog name the same variables', async () => {
  const { SECRETS } = await import('./setup-mcp/catalog.mjs');
  assert.deepEqual(SECRETS.map((s) => s.env).sort(), [...ENV_NAMES].sort());
});

test('every env-reading config references only .env.example names', () => {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const { dir } = run(['--clients', 'vscode,cursor,codex,copilot-cli', '--secrets', 'env'], {
    env: { COPILOT_HOME: home },
  });
  const texts = [
    read(dir, '.vscode', 'mcp.json'),
    read(dir, '.cursor', 'mcp.json'),
    read(dir, '.codex', 'config.toml'),
    read(home, 'mcp-config.json'),
  ];
  for (const text of texts) {
    const names = [...text.matchAll(/\b(LEANSCOPE_[A-Z_]+|[A-Z]+_API_KEY|[A-Z]+_TOKEN)\b/g)].map((m) => m[1]);
    assert.ok(names.length > 0);
    for (const name of names) assert.ok(ENV_NAMES.includes(name), `${name} is not in .env.example`);
  }
});

test('the docs and skills name no variable that .env.example lacks', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: kit,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /\.(md|mjs|json)$/.test(f))
    .filter((f) => !f.endsWith('.test.mjs') && f !== 'RELEASES.md'); // history may name old variables
  for (const file of files) {
    let text;
    try {
      text = read(kit, file);
    } catch {
      continue;
    }
    // Secret names only (other LEANSCOPE_* variables, such as a worker's settings, are fine).
    // `\b` doesn't match after `_`, so the second half finds bare `OPENAI_API_KEY` & co. only.
    for (const [name] of text.matchAll(/\bLEANSCOPE_[A-Z_]*(?:TOKEN|API_KEY)\b|\b(?:OPENAI|ANTHROPIC|MISTRAL|ELEVENLABS|TYPESAFE)_API_KEY\b/g)) {
      assert.ok(ENV_NAMES.includes(name), `${file}: ${name} — use the names in .env.example`);
    }
  }
});

// --- the other files VS Code and Copilot CLI load ------------------------------------------------

test('a root .mcp.json with leanscope-* servers is reported, never changed, and no value is printed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  const literal = 'not-a-real-token-0000';
  const root = JSON.stringify({
    mcpServers: {
      'leanscope-agents': {
        url: 'x',
        headers: { Authorization: 'Bearer ${LEANSCOPE_TOKEN}', 'X-LeanScope-Key-OpenAI': '${OPENAI_API_KEY}' },
      },
      'leanscope-admin': { url: 'x', headers: { Authorization: `Bearer ${literal}` } },
      mine: { url: 'y' },
    },
  });
  writeFileSync(join(dir, '.mcp.json'), root);
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const result = spawnSync(process.execPath, [script, '--project', dir, '--clients', 'vscode'], {
    env: { PATH: process.env.PATH, HOME: home },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Authorization references \$\{LEANSCOPE_TOKEN\}, which this kit doesn't define/);
  assert.match(result.stderr, /X-LeanScope-Key-OpenAI references \$\{OPENAI_API_KEY\}/);
  assert.match(result.stderr, /leanscope-admin: Authorization holds a literal value/);
  assert.match(result.stderr, /\.mcp\.json also registers leanscope-agents, leanscope-admin/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(literal), 'a header value was printed');
  assert.equal(read(dir, '.mcp.json'), root); // read-only
  assert.doesNotMatch(read(dir, '.vscode', 'mcp.json'), /LEANSCOPE_TOKEN|OPENAI_API_KEY"/); // nothing carried over
});

test('servers in both .vscode/mcp.json and the Copilot user config are reported as duplicates', () => {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const env = { COPILOT_HOME: home, LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN: 'set' };
  const first = runAll(['--clients', 'vscode'], env);
  assert.doesNotMatch(first.stderr, /twice/);
  const second = spawnSync(process.execPath, [script, '--project', first.dir, '--clients', 'copilot-cli'], {
    env: { PATH: process.env.PATH, HOME: first.home, ...env },
    encoding: 'utf8',
  });
  assert.match(second.stderr, /now in .*\.vscode\/mcp\.json and in .*mcp-config\.json/s);
  assert.match(second.stderr, /Keep one/);
  // Both files keep working as they are: the script reports, it doesn't delete.
  assert.ok(json(first.dir, '.vscode', 'mcp.json').servers['leanscope-admin']);
});

test('an empty root .mcp.json is reported as a leftover', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  writeFileSync(join(dir, '.mcp.json'), '{\n  "mcpServers": {\n  }\n}\n');
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  const result = spawnSync(process.execPath, [script, '--project', dir, '--clients', 'vscode'], {
    env: { PATH: process.env.PATH, HOME: home },
    encoding: 'utf8',
  });
  assert.match(result.stderr, /\.mcp\.json registers no MCP server at all/);
  assert.match(result.stderr, /--clean-root/);
  assert.ok(existsSync(join(dir, '.mcp.json'))); // reported, not deleted
});

// --- --clean-root ---------------------------------------------------------------------------------

const ROOT_MIXED = {
  mcpServers: { 'leanscope-admin': { url: 'x' }, 'leanscope-agents': { url: 'x' }, mine: { url: 'y' } },
  inputs: [{ id: 'leanscope-token' }, { id: 'other' }],
};

test('--clean-root removes only the leanscope-* servers and inputs, and keeps the rest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify(ROOT_MIXED));
  run(['--clean-root'], { dir });
  assert.deepEqual(json(dir, '.mcp.json'), { mcpServers: { mine: { url: 'y' } }, inputs: [{ id: 'other' }] });
});

test('--clean-root deletes the file when nothing else is left, and an already empty one', () => {
  for (const content of [
    JSON.stringify({ mcpServers: { 'leanscope-graphql': { url: 'x' } }, inputs: [{ id: 'leanscope-token' }] }),
    '{\n  "mcpServers": {\n  }\n}\n',
    '',
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
    writeFileSync(join(dir, '.mcp.json'), content);
    const { out } = run(['--clean-root'], { dir });
    assert.match(out, /deleted/);
    assert.ok(!existsSync(join(dir, '.mcp.json')), `still there: ${JSON.stringify(content)}`);
  }
});

test('--clean-root --dry-run changes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  writeFileSync(join(dir, '.mcp.json'), '{"mcpServers":{}}');
  const { out } = run(['--clean-root', '--dry-run'], { dir });
  assert.match(out, /would delete/);
  assert.equal(read(dir, '.mcp.json'), '{"mcpServers":{}}');
});

test('--clean-root leaves a file without leanscope-* servers alone, and copes with no file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  assert.match(run(['--clean-root'], { dir }).out, /nothing to clean/);
  const mine = '{"mcpServers":{"mine":{"url":"y"}}}';
  writeFileSync(join(dir, '.mcp.json'), mine);
  run(['--clean-root'], { dir });
  assert.equal(read(dir, '.mcp.json'), mine);
});

// --- --check ------------------------------------------------------------------------------------

const FAKE_TOKEN = 'fake-token-not-real-4711';

/** Run `--check` without blocking this process, so an in-process stub server can answer. */
function runCheck(args, { dir = mkdtempSync(join(tmpdir(), 'setup-mcp-')), home, env = {} } = {}) {
  home ??= mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, '--project', dir, '--check', ...args], {
      env: { PATH: process.env.PATH, HOME: home, COPILOT_HOME: join(home, '.copilot'), SHELL: '/bin/zsh', ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => done({ out, status, dir, home }));
  });
}

/** A stand-in for leanscope-admin: answers like the hosted channel for `respond(token)`. */
async function adminStub(respond) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      const { id, method } = JSON.parse(body);
      const answer = respond(token, method);
      if (answer.status) {
        res.writeHead(answer.status).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: answer.result }));
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}/mcp/admin`, close: () => server.close() };
}

const permissions = (repositoryIds) => (token, method) =>
  method === 'initialize'
    ? { result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'stub', version: '1' } } }
    : { result: { content: [{ type: 'text', text: '{}' }], structuredContent: { kind: 'access-token', repositoryIds } } };

test('--check: no token anywhere → exit 1, names the variable and one command to open the profile', async () => {
  const { out, status } = await runCheck(['--clients', 'copilot-cli']);
  assert.equal(status, 1);
  assert.match(out, /LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN: not set in this shell, not exported/);
  assert.match(out, /Next:/);
  // Opens the profile outside VS Code (an open editor tab is sent to the chat) and shows the lines.
  assert.match(out, /`(open -e|nano|vi) .*\.zshrc`/);
  assert.doesNotMatch(out, /`code [^`]*\.zshrc`/);
  assert.match(out, /export LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN="…"/);
  assert.match(out, /doesn't exist yet/); // no config written yet
});

test('--check: finds the export line in a shell profile by name, and never prints its value', async () => {
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  writeFileSync(join(home, '.zshrc'), `export LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN=${FAKE_TOKEN}\n`);
  const { out } = await runCheck(['--clients', 'copilot-cli', '--probe-url', 'http://127.0.0.1:9/x'], { home });
  assert.match(out, /not set in this shell, exported in .*\.zshrc/);
  assert.ok(!out.includes(FAKE_TOKEN), 'the value was printed');
});

test('--check: token only in the profile → probes that token, and blames the start, not the file', async (t) => {
  if (spawnSync('zsh', ['-c', 'true']).status !== 0) return t.skip('no zsh here');
  let received;
  const stub = await adminStub((token, method) => {
    received = token;
    return permissions([2067])(token, method);
  });
  try {
    const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
    writeFileSync(join(home, '.zshrc'), `export LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN="${FAKE_TOKEN}"\n`);
    const { out } = await runCheck(['--clients', 'copilot-cli', '--probe-url', stub.url], { home });
    assert.equal(received, FAKE_TOKEN); // read from the profile by an interactive shell
    assert.match(out, /with the token in .*\.zshrc: ok, the token reaches repository 2067/);
    assert.match(out, /was started without it/);
    assert.match(out, /Reload Window or reopening it from the Dock is not enough/);
    assert.doesNotMatch(out, /spelling/);
    assert.ok(!out.includes(FAKE_TOKEN), 'the value was printed');
  } finally {
    stub.close();
  }
});

test('--check probes leanscope-admin: a rejected token is named, a good one shows its repository', async () => {
  const rejecting = await adminStub(() => ({ status: 401 }));
  const accepting = await adminStub(permissions([2067]));
  try {
    const env = { LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN: FAKE_TOKEN };
    const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
    const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
    execFileSync(process.execPath, [script, '--project', dir, '--clients', 'copilot-cli'], {
      env: { PATH: process.env.PATH, HOME: home, COPILOT_HOME: join(home, '.copilot'), ...env },
      stdio: 'ignore',
    });

    const bad = await runCheck(['--clients', 'copilot-cli', '--probe-url', rejecting.url], { dir, home, env });
    assert.equal(bad.status, 1);
    assert.match(bad.out, /rejected \(HTTP 401\)/);
    assert.match(bad.out, /app\.leanscope\.ai/);
    assert.ok(!bad.out.includes(FAKE_TOKEN), 'the token was printed');

    const good = await runCheck(['--clients', 'copilot-cli', '--probe-url', accepting.url], { dir, home, env });
    assert.match(good.out, /registers leanscope-admin, leanscope-graphql, leanscope-agents/);
    assert.match(good.out, /ok, the token reaches repository 2067/);
    assert.ok(!good.out.includes(FAKE_TOKEN), 'the token was printed');
  } finally {
    rejecting.close();
    accepting.close();
  }
});

test('--check: a tool error "did not accept" counts as rejected; no connection is named as such', async () => {
  const refusing = await adminStub((token, method) =>
    method === 'initialize'
      ? permissions([])(token, method)
      : { result: { isError: true, content: [{ type: 'text', text: 'LeanScope did not accept the token.' }] } },
  );
  try {
    const env = { LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN: FAKE_TOKEN };
    const refused = await runCheck(['--clients', 'copilot-cli', '--probe-url', refusing.url], { env });
    assert.match(refused.out, /rejected: LeanScope did not accept the token/);
    const offline = await runCheck(['--clients', 'copilot-cli', '--probe-url', 'http://127.0.0.1:9/mcp/admin'], { env });
    assert.match(offline.out, /no connection to/);
  } finally {
    refusing.close();
  }
});

test('--check needs exactly one client', () => {
  const result = runAll(['--check', '--clients', 'vscode,cursor']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exactly one --clients/);
});

test('a clean setup of the kit’s own files warns about nothing', async () => {
  const { inspect } = await import('./setup-mcp/inspect.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'setup-mcp-'));
  const home = mkdtempSync(join(tmpdir(), 'setup-mcp-home-'));
  run(['--clients', 'vscode'], { dir });
  const saved = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = join(home, '.copilot'); // never look at the developer's real config
  try {
    assert.deepEqual(inspect({ project: dir, home }, ['vscode']), []);
  } finally {
    if (saved === undefined) delete process.env.COPILOT_HOME;
    else process.env.COPILOT_HOME = saved;
  }
});

test('the quickstart decides the session type first and maps each to its setup', () => {
  const skill = read(kit, 'skills', 'leanscope-quickstart', 'SKILL.md');
  assert.ok(skill.indexOf('Which client and session are you in?') < skill.indexOf('### Run the setup'));
  const row = (label) => skill.split('\n').find((l) => l.startsWith(`| ${label}`)) ?? '';
  assert.match(row('VS Code, **Local** session'), /`vscode`.*yes/);
  assert.match(row('VS Code, **Copilot** session'), /`copilot-cli`.*\*\*no\*\*/);
  assert.match(row('Copilot CLI in a terminal'), /`copilot-cli`.*\*\*no\*\*/);
  assert.match(skill, /Never create a workspace-root `\.mcp\.json`/);
  assert.match(skill, /Never promise VS Code's masked dialog/);
  // Troubleshooting tells missing configuration apart from authentication/startup, per client.
  assert.match(skill, /not configured in this client/);
  assert.match(skill, /That's authentication or startup, not missing configuration/);
  assert.match(skill, /### Reload the servers/);
});

test('the quickstart asks for the client first, never for the repository id, and diagnoses with --check', () => {
  const skill = read(kit, 'skills', 'leanscope-quickstart', 'SKILL.md');
  const agents = read(kit, 'AGENTS.md');
  // The client question comes before the connection check.
  assert.ok(skill.indexOf('## 0. Which client and session are you in?') < skill.indexOf('## 1. Check the connection'));
  assert.match(skill, /Ask this once per conversation/);
  assert.match(skill, /\*\*don't ask again\*\*/);
  assert.doesNotMatch(skill, /every time/);
  // Secrets stay out of the chat: no reading profiles, no opening them in VS Code.
  assert.match(skill, /Never read a file that may hold a secret/);
  assert.doesNotMatch(skill, /`code ~\/\.(zshrc|bashrc)`/);
  assert.match(agents, /Never read a file that may hold one/);
  // No fallback that asks the user for the id.
  assert.match(skill, /\*\*Never ask the user for it\.\*\*/);
  assert.doesNotMatch(skill, /ask the user for the id/i);
  assert.doesNotMatch(agents, /ask the user for the id/i);
  // The token check is admin's, for all three servers.
  assert.match(skill, /`get_credential_permissions` is the token check for all three servers/);
  // Diagnose, then one command; tidy a root .mcp.json with the script, never by hand.
  assert.match(skill, /--check --clients <id>/);
  assert.match(skill, /--clean-root/);
  assert.match(skill, /never leave an empty config file behind/);
});

// --- the kit's own plugin manifests -------------------------------------------------------------

test('the committed Claude Code plugin manifest is what the catalog generates', async () => {
  const { default: plugin } = await import('./setup-mcp/clients/claude-plugin.mjs');
  const file = plugin.target({ kit: join(here, '..') });
  const committed = readFileSync(file, 'utf8');
  assert.equal(
    plugin.merge(committed, plugin.render({}), file),
    committed,
    'run `node scripts/setup-mcp.mjs --clients claude-plugin` and commit the result',
  );
  const { mcpServers, userConfig } = JSON.parse(committed);
  assert.equal(mcpServers['leanscope-admin'].url, `${HOST}/mcp/admin`);
  assert.equal(userConfig.token.sensitive, true);
});

test('no root .mcp.json: VS Code and Copilot CLI would load it and fail on ${user_config.…}', () => {
  assert.throws(() => read(here, '..', '.mcp.json'));
});

test('every plugin manifest carries the same version', () => {
  const kit = join(here, '..');
  const versions = [
    json(kit, 'plugin.json').version,
    json(kit, '.claude-plugin', 'plugin.json').version,
    json(kit, '.claude-plugin', 'marketplace.json').plugins[0].version,
    json(kit, '.codex-plugin', 'plugin.json').version,
    json(kit, '.cursor-plugin', 'plugin.json').version,
    json(kit, 'package.json').version,
  ];
  assert.equal(new Set(versions).size, 1, versions.join(', '));
  assert.match(read(kit, 'RELEASES.md'), new RegExp(`## ${versions[0].replaceAll('.', '\\.')} `));
});

test('package.json runs the setup script, so `npx github:leanscope/leanscope-agent-kit` needs no clone', () => {
  const kit = join(here, '..');
  const { bin, dependencies } = json(kit, 'package.json');
  assert.deepEqual(Object.values(bin), ['scripts/setup-mcp.mjs']); // npx picks the only bin
  assert.equal(dependencies, undefined);
  assert.match(read(kit, 'scripts', 'setup-mcp.mjs'), /^#!\/usr\/bin\/env node\n/);
});

test('the token has one name everywhere: "personal team-repos access token"', () => {
  const kit = join(here, '..');
  for (const file of [
    'README.md',
    '.env.example',
    '.claude-plugin/plugin.json',
    'scripts/setup-mcp/catalog.mjs',
    'skills/leanscope-quickstart/SKILL.md',
  ]) {
    // The old spellings: "team repos" without the hyphen, and "repository access token".
    assert.doesNotMatch(read(kit, file), /team repos access token|repository access token/i, file);
  }
});

test('every LeanScope service URL uses the catalog STAGE (the one dev/prod switch)', () => {
  const kit = join(here, '..');
  // app.leanscope.ai is where users get their token: it has no stage.
  const services = /https:\/\/((?:[a-z0-9-]+\.)*?)(mcp|api\.agents|agents)\.leanscope\.ai/g;
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: kit,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((f) => f !== 'RELEASES.md'); // history may name the old host
  for (const file of files) {
    let text;
    try {
      text = read(kit, file);
    } catch {
      continue; // deleted but still in the index
    }
    for (const [url, stage] of text.matchAll(services)) {
      assert.equal(stage, STAGE, `${file}: ${url} — set the stage in scripts/setup-mcp/catalog.mjs only`);
    }
  }
});

test('the README links the agent API docs of the catalog stage', () => {
  assert.ok(read(here, '..', 'README.md').includes(AGENT_API_DOCS), AGENT_API_DOCS);
});

test('the root plugin.json is Agent Plugins 1.0 and declares no servers', () => {
  const kit = join(here, '..');
  const manifest = json(kit, 'plugin.json');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.mcpServers, undefined);
  // Agent Plugins' mcp.json has no `inputs` and expands no ${input:…}: it can't ask for a token.
  assert.throws(() => read(kit, 'mcp.json'));
});

// --- CLI ---------------------------------------------------------------------------------------

test('--vendors still works as the old name of --clients', () => {
  const { dir } = run(['--vendors', 'cursor']);
  assert.ok(json(dir, '.cursor', 'mcp.json').mcpServers['leanscope-admin']);
});

test('a missing token is reported per env client, naming the variable and the file', () => {
  const { out, stderr } = runAll(['--clients', 'vscode,cursor']);
  assert.match(stderr, /Cursor reads LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN .*\.cursor\/mcp\.json/s);
  assert.doesNotMatch(stderr, /VS Code/); // VS Code prompts
  assert.match(out, /VS Code \(Local sessions\): In a Local session.*VS Code asks/);
});

test('no warning when the token is set', () => {
  const { stderr } = runAll(['--clients', 'cursor'], {
    LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN: 'set',
  });
  assert.equal(stderr, '');
});

test('unknown clients and keys fail', () => {
  assert.throws(() => run(['--clients', 'emacs']), /unknown client "emacs"/);
  assert.throws(() => run(['--clients', 'vscode', '--keys', 'token']), /unknown --keys token/);
});

test('dry run writes nothing', () => {
  const { dir, out } = run(['--vendors', 'cursor', '--dry-run']);
  assert.match(out, /would write .*\.cursor\/mcp\.json/);
  assert.throws(() => read(dir, '.cursor', 'mcp.json'));
});
