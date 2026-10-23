// Tests for scripts/setup-mcp.mjs. Zero dependencies: `node --test 'scripts/**/*.test.mjs'`.
//
// The first block pins what the script wrote before the refactor into one writer per client
// (characterization). It may change only where a change is intended.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'setup-mcp.mjs');
const HOST = 'https://dev.mcp.leanscope.ai';

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
env_http_headers = { "X-LeanScope-Key-OpenAI" = "LEANSCOPE_OPENAI_API_KEY", "X-LeanScope-Key-Anthropic" = "LEANSCOPE_ANTHROPIC_API_KEY", "X-LeanScope-Key-Mistral" = "LEANSCOPE_MISTRAL_API_KEY", "X-LeanScope-Key-ElevenLabs" = "LEANSCOPE_ELEVENLABS_API_KEY" }
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
  ];
  assert.equal(new Set(versions).size, 1, versions.join(', '));
  assert.match(read(kit, 'RELEASES.md'), new RegExp(`## ${versions[0].replaceAll('.', '\\.')} `));
});

test('the root plugin.json is Agent Plugins 1.0 and declares no servers', () => {
  const kit = join(here, '..');
  const manifest = json(kit, 'plugin.json');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.mcpServers, undefined);
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
  assert.match(out, /VS Code \(Copilot Agent\): VS Code asks/);
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
