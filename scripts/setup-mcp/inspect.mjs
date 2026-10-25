// Read-only look at the other MCP files a client may load next to the one the setup wrote, so the
// user hears about `leanscope-*` servers that would show up twice, or that reference a secret by
// a name this kit doesn't use. It never changes these files and never prints a header's value.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRETS, SERVERS } from './catalog.mjs';
import copilotCli from './clients/copilot-cli.mjs';

const OURS = new Set(SERVERS.map((s) => s.name));

/** What a `${…}` in one of our headers may name: a catalog variable, a kit input, a plugin option. */
const ALLOWED = SECRETS.flatMap((s) => [
  s.env,
  `${s.env}:-`,
  `env:${s.env}`,
  `input:leanscope-${s.id}`,
  `user_config.${s.id}`,
]);

/** The files that VS Code (either harness) and Copilot CLI may load together. */
export const sharedConfigs = ({ project, home }) => [
  { file: join(project, '.vscode', 'mcp.json'), what: '.vscode/mcp.json', client: 'vscode' },
  { file: copilotCli.target({ home }), what: 'the Copilot user config', client: 'copilot-cli' },
  { file: join(project, '.mcp.json'), what: 'the workspace-root .mcp.json', client: undefined },
];

/** The `leanscope-*` servers in a config's text, each with what is wrong with its headers. */
export function leanscopeEntries(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return [];
  }
  // VS Code uses `servers`, the portable format `mcpServers`, Copilot project files may be bare.
  const servers = config.servers ?? config.mcpServers ?? config;
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers)
    .filter(([name]) => OURS.has(name))
    .map(([name, server]) => ({ name, problems: problems(server) }));
}

function problems(server) {
  const found = [];
  for (const [header, value] of Object.entries(server?.headers ?? {})) {
    if (typeof value !== 'string') continue;
    const refs = [...value.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
    if (refs.length === 0 && value.replace(/^Bearer\s*/, '').trim()) {
      found.push(`${header} holds a literal value instead of a reference`); // never echo the value
    }
    for (const ref of refs) {
      if (!ALLOWED.includes(ref)) found.push(`${header} references \${${ref}}, which this kit doesn't define`);
    }
  }
  return found;
}

/**
 * Warnings about the shared files, after `written` (the clients just set up) were written.
 * `read(file)` returns a file's text or undefined.
 */
export function inspect(context, written, read = readIfThere) {
  const configs = sharedConfigs(context).map((c) => {
    const text = read(c.file);
    return { ...c, entries: text ? leanscopeEntries(text) : [] };
  });
  const warnings = [];

  for (const c of configs) {
    for (const { name, problems } of c.entries) {
      for (const p of problems) warnings.push(`${c.file}: ${name}: ${p}.`);
    }
  }

  const root = configs.find((c) => c.client === undefined);
  if (root.entries.length > 0) {
    warnings.push(
      `${root.file} also registers ${root.entries.map((e) => e.name).join(', ')}. The kit never writes ` +
        'this file, and VS Code and Copilot CLI load it next to their own config, so the servers ' +
        'show up twice. Remove those entries from it (keep the others).',
    );
  }

  const vscode = configs.find((c) => c.client === 'vscode');
  const copilot = configs.find((c) => c.client === 'copilot-cli');
  const touched = written.includes('vscode') || written.includes('copilot-cli');
  if (touched && vscode.entries.length > 0 && copilot.entries.length > 0) {
    warnings.push(
      `The leanscope-* servers are now in ${vscode.file} and in ${copilot.file}. VS Code Local ` +
        'sessions can load both, and then list them twice. Keep one: only Local sessions → keep ' +
        `${vscode.what}; Copilot sessions or Copilot CLI → keep ${copilot.what} and remove the ` +
        'leanscope-* servers and inputs from .vscode/mcp.json.',
    );
  }
  return warnings;
}

function readIfThere(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}
