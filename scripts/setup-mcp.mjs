#!/usr/bin/env node
// Connect your coding agent to LeanScope — writes the MCP configuration for VS Code (GitHub
// Copilot), Cursor and Codex into a project. Claude Code needs none of this: the plugin ships its
// own `.mcp.json`.
//
//   node scripts/setup-mcp.mjs [--project <dir>] [--vendors vscode,cursor,codex] [--dry-run]
//
// Every server entry REFERENCES your environment variables (see `.env.example`) — no token or key is
// ever written into a file.
//
// Existing configuration is kept: only the three `leanscope-*` servers are added or replaced.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const project = resolve(option('project', process.cwd()));
const vendors = option('vendors', 'vscode,cursor,codex').split(',').map((v) => v.trim());
const dryRun = args.includes('--dry-run');
const MCP_URL = 'https://dev.mcp.leanscope.ai';

const KEY_HEADERS = {
  'X-LeanScope-Key-OpenAI': 'LEANSCOPE_OPENAI_API_KEY',
  'X-LeanScope-Key-Anthropic': 'LEANSCOPE_ANTHROPIC_API_KEY',
  'X-LeanScope-Key-Mistral': 'LEANSCOPE_MISTRAL_API_KEY',
  'X-LeanScope-Key-ElevenLabs': 'LEANSCOPE_ELEVENLABS_API_KEY',
};

/** The three servers, for clients that read `${env:NAME}` (VS Code, Cursor). */
function envServers(withType) {
  const type = withType ? { type: 'http' } : {};
  return {
    'leanscope-admin': {
      ...type,
      url: `${MCP_URL}/mcp/admin`,
      headers: { Authorization: 'Bearer ${env:LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN}' },
    },
    'leanscope-graphql': {
      ...type,
      url: `${MCP_URL}/mcp/graphql-v2`,
      headers: { Authorization: 'Bearer ${env:LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN}' },
    },
    'leanscope-agents': {
      ...type,
      url: `${MCP_URL}/mcp/agents`,
      headers: {
        Authorization: 'Bearer ${env:LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN}',
        ...Object.fromEntries(
          Object.entries(KEY_HEADERS).map(([header, env]) => [header, `\${env:${env}}`]),
        ),
      },
    },
  };
}

/** Merge our servers into a JSON config file under `rootKey`, keeping everything else. */
function writeJsonServers(file, rootKey, servers) {
  const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const next = { ...current, [rootKey]: { ...(current[rootKey] ?? {}), ...servers } };
  write(file, `${JSON.stringify(next, null, 2)}\n`);
}

// Codex reads TOML. Rather than parse and re-serialise a file this script does not own, it owns ONE
// block between two marker lines and replaces exactly that block on every run. The markers are
// written by this script and nothing else, so matching them is reliable — the rest of the file is
// never touched or reformatted.
const BEGIN = '# >>> leanscope agent-kit (managed by scripts/setup-mcp.mjs) >>>';
const END = '# <<< leanscope agent-kit <<<';

function codexBlock() {
  const headers = Object.entries(KEY_HEADERS)
    .map(([header, env]) => `"${header}" = "${env}"`)
    .join(', ');
  return [
    BEGIN,
    '[mcp_servers.leanscope-admin]',
    `url = "${MCP_URL}/mcp/admin"`,
    'bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"',
    '',
    '[mcp_servers.leanscope-graphql]',
    `url = "${MCP_URL}/mcp/graphql-v2"`,
    'bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"',
    '',
    '[mcp_servers.leanscope-agents]',
    `url = "${MCP_URL}/mcp/agents"`,
    'bearer_token_env_var = "LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN"',
    `env_http_headers = { ${headers} }`,
    END,
  ].join('\n');
}

function writeCodexConfig(file) {
  const block = codexBlock();
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const start = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  const next =
    start >= 0 && end > start
      ? `${current.slice(0, start)}${block}${current.slice(end + END.length)}`
      : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${current ? '\n' : ''}${block}\n`;
  write(file, next);
}

function write(file, content) {
  if (dryRun) {
    console.log(`--- would write ${file}\n${content}`);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`✓ ${file}`);
}

const writers = {
  vscode: () => writeJsonServers(join(project, '.vscode', 'mcp.json'), 'servers', envServers(true)),
  cursor: () => writeJsonServers(join(project, '.cursor', 'mcp.json'), 'mcpServers', envServers(false)),
  codex: () => writeCodexConfig(join(project, '.codex', 'config.toml')),
};

let failed = false;
for (const vendor of vendors) {
  const writer = writers[vendor];
  if (!writer) {
    console.error(`✗ unknown vendor "${vendor}" — use vscode, cursor or codex`);
    failed = true;
    continue;
  }
  try {
    writer();
  } catch (error) {
    console.error(`✗ ${vendor}: ${error.message}`);
    failed = true;
  }
}

const missing = ['LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN'].filter(
  (name) => !process.env[name]?.trim(),
);
if (missing.length > 0) {
  console.warn(
    `\n! Not set in this environment: ${missing.join(', ')}. Your agent's MCP servers read them ` +
      'when they connect — set them where your editor is started (see .env.example).',
  );
}
console.log(
  '\nCodex reads a project .codex/config.toml only in trusted projects; Cursor and VS Code read ' +
    'their files on the next start of the agent.',
);
process.exit(failed ? 1 : 0);
