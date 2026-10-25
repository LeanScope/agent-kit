#!/usr/bin/env node
// Connect your coding agent to LeanScope: writes the MCP configuration for one or more clients.
//
//   npx -y github:leanscope/agent-kit --clients <ids> [options]     (no clone needed)
//   node scripts/setup-mcp.mjs --clients <ids> [--project <dir>] [--secrets prompt|env]
//                              [--keys openai,anthropic,mistral,elevenlabs] [--dry-run]
//
//   --project  the user's project. Default: the current directory.
//   --clients  vscode (Copilot Agent sessions), copilot-cli (writes ~/.copilot/mcp-config.json),
//              cursor, codex, claude-code (enables the kit's plugin in .claude/settings.json).
//              Default: vscode,cursor,codex.
//              `--vendors` is the old name and still works for this release.
//   --secrets  prompt (default): the client asks for the token and keys and stores them itself,
//              where it can (VS Code). env: reference environment variables (see `.env.example`).
//              Clients that can't prompt always use env.
//   --keys     which optional LLM keys to wire up. Default: openai when prompting (every key is
//              its own dialog), all of them for env.
//
// No token or key is ever written into a file: entries only REFERENCE them. Existing configuration
// is kept; only the `leanscope-*` servers (and their prompts) are added or replaced.
//
// Claude Code's plugin brings its own servers and asks for the secrets; `--clients claude-code`
// only enables that plugin for the project. For kit maintainers, `--clients claude-plugin`
// regenerates the plugin's manifest from the catalog, and `--clients vscode-plugin` the root mcp.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRETS } from './setup-mcp/catalog.mjs';
import { CLIENTS } from './setup-mcp/clients/index.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const list = (value) => value?.split(',').map((v) => v.trim()).filter(Boolean);

const context = {
  project: resolve(option('project', process.cwd())),
  home: homedir(),
  kit: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
};
const clientIds = list(option('clients', option('vendors', 'vscode,cursor,codex')));
const options = { secrets: option('secrets', 'prompt'), keys: list(option('keys')) };
const dryRun = args.includes('--dry-run');

let failed = false;
const fail = (message) => {
  console.error(`✗ ${message}`);
  failed = true;
};

if (!['prompt', 'env'].includes(options.secrets)) fail(`--secrets must be prompt or env`);
const unknownKeys = (options.keys ?? []).filter((k) => !SECRETS.some((s) => s.id === k && !s.required));
if (unknownKeys.length > 0) {
  fail(`unknown --keys ${unknownKeys.join(', ')} — use openai, anthropic, mistral, elevenlabs`);
}
if (failed) process.exit(1);

const notes = [];
const missing = [];
for (const id of clientIds) {
  const client = CLIENTS[id];
  if (!client) {
    fail(`unknown client "${id}" — use ${Object.keys(CLIENTS).join(', ')}`);
    continue;
  }
  try {
    const file = client.target(context);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    write(file, client.merge(current, client.render(options), file));
    notes.push(`${client.name}: ${client.after(options)}`);
    for (const s of client.envSecrets(options)) {
      if (s.required && !process.env[s.env]?.trim()) missing.push({ client, file, secret: s });
    }
  } catch (error) {
    fail(`${id}: ${error.message}`);
  }
}

for (const { client, file, secret } of missing) {
  console.warn(
    `\n! ${client.name} reads ${secret.env} from the environment (${file}), and it isn't set in ` +
      'this shell. Add `export ' +
      `${secret.env}=…\` to your shell profile (~/.zshrc or ~/.bashrc), then restart ${client.name} ` +
      'from a new terminal. Never paste the value into a chat.',
  );
}
if (notes.length > 0) console.log(`\n${notes.join('\n')}`);
process.exit(failed ? 1 : 0);

function write(file, content) {
  if (dryRun) {
    console.log(`--- would write ${file}\n${content}`);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`✓ ${file}`);
}
