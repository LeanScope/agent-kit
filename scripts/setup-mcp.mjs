#!/usr/bin/env node
// Connect your coding agent to LeanScope: writes the MCP configuration for one or more clients.
//
//   npx -y github:leanscope/leanscope-agent-kit --clients <ids> [options]     (no clone needed)
//   node scripts/setup-mcp.mjs --clients <ids> [--project <dir>] [--secrets prompt|env]
//                              [--keys openai,anthropic,mistral,elevenlabs] [--dry-run]
//   node scripts/setup-mcp.mjs --check --clients <id>       (diagnose, writes nothing)
//   node scripts/setup-mcp.mjs --clean-root [--dry-run]     (tidy a workspace-root .mcp.json)
//
//   --project  the user's project. Default: the current directory.
//   --clients  vscode (VS Code *Local* sessions, .vscode/mcp.json), copilot-cli (Copilot CLI and
//              VS Code *Copilot* sessions, ~/.copilot/mcp-config.json), cursor, codex,
//              claude-code (enables the kit's plugin in .claude/settings.json).
//              Default: vscode,cursor,codex.
//              `--vendors` is the old name and still works for this release.
//   --secrets  prompt (default): the client asks for the token and keys and stores them itself,
//              where it can (VS Code Local sessions only: Copilot sessions skip servers that need
//              an input). env: reference environment variables (see `.env.example`).
//              Clients that can't prompt always use env.
//
// Afterwards it reads (never changes) the other files VS Code and Copilot CLI load, and warns about
// `leanscope-*` servers that would show up twice or that name a secret this kit doesn't define.
//   --check    read-only diagnosis for ONE client (writes nothing): its config file, whether each
//              secret is set in this shell and exported in a shell profile (names only), and a
//              live call of leanscope-admin with the token, then the next step. Exit 1 on a problem.
//   --clean-root  removes only the leanscope-* servers and inputs from the workspace-root
//              `.mcp.json` (which the kit never writes) and deletes the file if nothing is left.
//              Honors --dry-run.
//   --keys     which optional LLM keys to wire up. Default: openai when prompting (every key is
//              its own dialog), all of them for env.
//
// No token or key is ever written into a file: entries only REFERENCE them. Existing configuration
// is kept; only the `leanscope-*` servers (and their prompts) are added or replaced.
//
// Claude Code's plugin brings its own servers and asks for the secrets; `--clients claude-code`
// only enables that plugin for the project. For kit maintainers, `--clients claude-plugin`
// regenerates the plugin's manifest from the catalog.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRETS, SERVERS } from './setup-mcp/catalog.mjs';
import { check } from './setup-mcp/check.mjs';
import { CLIENTS } from './setup-mcp/clients/index.mjs';
import { inspect, isEmptyConfig } from './setup-mcp/inspect.mjs';
import { parse, removeServers, stringify } from './setup-mcp/json.mjs';

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

if (args.includes('--clean-root')) process.exit(cleanRoot());

if (args.includes('--check')) {
  const id = option('clients', option('vendors'));
  if (!id || id.includes(',') || !CLIENTS[id]) {
    console.error(`✗ --check needs exactly one --clients <id>: ${Object.keys(CLIENTS).join(', ')}`);
    process.exit(1);
  }
  // A test-only override, so the probe can hit a local stub instead of the hosted admin channel.
  const probeUrl = option('probe-url');
  const result = await check(context, CLIENTS[id], options, { probeUrl });
  console.log(result.lines.join('\n'));
  process.exit(result.ok ? 0 : 1);
}

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
// Read-only: report leanscope-* servers that would load twice or name a secret wrongly.
for (const warning of inspect(context, clientIds)) console.warn(`\n! ${warning}`);
if (notes.length > 0) console.log(`\n${notes.join('\n')}`);
process.exit(failed ? 1 : 0);

/** `--clean-root`: drop our servers from the workspace-root .mcp.json; delete it if empty. */
function cleanRoot() {
  const file = join(context.project, '.mcp.json');
  if (!existsSync(file)) {
    console.log(`✓ no ${file}, nothing to clean`);
    return 0;
  }
  const text = readFileSync(file, 'utf8');
  let config;
  try {
    config = parse(text, file);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    return 1;
  }
  const ours = new Set(SERVERS.map((s) => s.name));
  const next = isEmptyConfig(text) ? undefined : removeServers(config, (n) => ours.has(n), 'leanscope-');
  if (next === undefined) {
    if (dryRun) console.log(`--- would delete ${file} (nothing else is left in it)`);
    else {
      rmSync(file);
      console.log(`✓ deleted ${file} (nothing else was left in it)`);
    }
    return 0;
  }
  const content = stringify(next);
  if (content === stringify(config)) {
    console.log(`✓ ${file} holds no leanscope-* servers, left as it is`);
    return 0;
  }
  write(file, content);
  return 0;
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
