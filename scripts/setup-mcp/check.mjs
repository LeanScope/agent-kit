// `--check`: a read-only diagnosis for one client, so the agent can report what is wrong instead of
// sending the user off to look at files. It writes nothing and never prints a secret's value:
//   1. the client's config file, and which leanscope-* servers it registers;
//   2. per secret: set in this shell's environment? exported in a shell profile? (names only);
//   3. a live probe: `get_credential_permissions` on leanscope-admin with the token from this
//      environment, or else from the shell profile (read by an interactive shell, held in memory,
//      never printed): ok (repository …), rejected (401/403), channel missing (404), no network;
//   4. one next step, as a command or a file to open.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETPLACE, PLUGIN, SERVERS, secret, url } from './catalog.mjs';
import { leanscopeEntries } from './inspect.mjs';

const TOKEN = secret('token');
const ADMIN = SERVERS.find((s) => s.name === 'leanscope-admin');
const PROFILES = ['.zshenv', '.zshrc', '.zprofile', '.bashrc', '.bash_profile', '.profile'];

/** Which clients read the secrets from the environment, and how each reloads after a change. */
const RELOAD = {
  'copilot-cli':
    'quit VS Code completely (⌘Q; Reload Window or reopening it from the Dock is not enough), open a NEW Terminal window, run `code <project>` there, and open a new Copilot session (Copilot CLI: open a new terminal and start `copilot`)',
  vscode: 'quit VS Code completely (⌘Q), open a NEW Terminal window and run `code <project>` there',
  codex: 'quit Codex, then start it from a new terminal',
  cursor: 'quit Cursor, then start it from a new terminal with `cursor <project>`',
};

/**
 * Run the diagnosis. Returns { ok, lines }. `deps` exists for tests: `env`, `fetch`, `probeUrl`.
 */
export async function check(context, client, options, deps = {}) {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? globalThis.fetch;
  const lines = [];
  const next = [];
  let ok = true;
  const say = (mark, text) => lines.push(`${mark} ${text}`);
  const setup = join(context.kit, 'scripts', 'setup-mcp.mjs');

  // 1. The config file.
  const file = client.target(context);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  const registered = registeredServers(client.id, text);
  const allThree = SERVERS.every((s) => registered.includes(s.name));
  if (text === undefined) {
    ok = false;
    say('✗', `${client.name}: ${file} doesn't exist yet.`);
    next.push(`run the setup: node ${setup} --clients ${client.id}`);
  } else if (client.id === 'claude-code') {
    if (registered.length > 0) say('✓', `Claude Code: ${file} enables the ${PLUGIN}@${MARKETPLACE} plugin (it brings the servers).`);
    else {
      ok = false;
      say('✗', `Claude Code: ${file} doesn't enable the ${PLUGIN}@${MARKETPLACE} plugin.`);
      next.push(`run the setup: node ${setup} --clients claude-code`);
    }
  } else if (allThree) {
    say('✓', `${client.name}: ${file} registers ${registered.join(', ')}.`);
  } else {
    ok = false;
    const missing = SERVERS.map((s) => s.name).filter((n) => !registered.includes(n));
    say('✗', `${client.name}: ${file} lacks ${missing.join(', ')}.`);
    next.push(`run the setup: node ${setup} --clients ${client.id}`);
  }

  // 2. The secrets. Only clients that read the environment depend on them.
  const readsEnv = client.envSecrets(options).length > 0;
  const profiles = PROFILES.map((name) => join(context.home, name)).filter((f) => existsSync(f));
  const exportedIn = (name) => {
    const line = new RegExp(`^\\s*(export\\s+)?${name}=\\S`, 'm');
    return profiles.filter((f) => line.test(readFileSync(f, 'utf8')));
  };
  const profile = defaultProfile(context.home, env);
  const tokenSet = Boolean(env[TOKEN.env]?.trim());
  const tokenExported = exportedIn(TOKEN.env);

  const edit = (file) => editCommand(file, env);

  if (!readsEnv) {
    say(
      '–',
      client.id === 'claude-code'
        ? 'Claude Code keeps the token and keys in its plugin settings, not in the environment.'
        : "VS Code Local sessions ask for the token in a masked dialog; they don't read the environment.",
    );
  }
  for (const s of client.envSecrets(options)) {
    const set = Boolean(env[s.env]?.trim());
    const where = exportedIn(s.env);
    const exported = where.length > 0 ? `exported in ${where.join(', ')}` : 'not exported in any shell profile';
    const mark = set ? '✓' : s.required ? '✗' : '–';
    say(mark, `${s.env}: ${set ? 'set' : 'not set'} in this shell, ${exported}.`);
    if (s.required && !set) {
      ok = false;
      if (where.length === 0) {
        next.push(
          `in Terminal, run \`${edit(profile)}\` (outside VS Code: a file open in VS Code is sent to the chat), ` +
            `add these lines at the very end, with your values between the quotes, and save:\n` +
            `       export ${s.env}="…"   (from https://app.leanscope.ai/, avatar top-right)\n` +
            `       export LEANSCOPE_OPENAI_API_KEY="…"   (optional, needed to run choreos)`,
        );
      } else {
        next.push(
          `${where[0]} has the variable, but ${client.name} was started without it. ` +
            'Started from the Dock or Spotlight, VS Code does not hand your shell profile to Copilot sessions. Nothing in the file needs to change',
        );
      }
    }
  }
  if (readsEnv && !client.envSecrets(options).some((s) => !s.required && env[s.env]?.trim())) {
    say('–', 'No LLM key is set: you can model choreos, but running one needs at least one.');
  }

  // 3. The live probe, with the token this shell sees, or else the one in the shell profile.
  const fromProfile = !tokenSet && tokenExported.length > 0;
  const token = tokenSet ? env[TOKEN.env].trim() : fromProfile ? (deps.profileValue ?? profileValue)(TOKEN.env, env) : '';
  if (!token) {
    say('–', `Probe skipped: ${TOKEN.env} isn't set in this shell${fromProfile ? ', and an interactive shell could not read it from your profile' : ''}.`);
  } else {
    const result = await probe(deps.probeUrl ?? url(ADMIN), token, doFetch);
    const which = fromProfile ? `the token in ${tokenExported[0]}` : 'that token';
    say(result.ok ? '✓' : '✗', `leanscope-admin with ${which}: ${result.text}`);
    if (!result.ok) ok = false;
    if (result.rejected) {
      const at = tokenExported[0] ?? profile;
      next.push(
        `get a fresh personal team-repos access token at https://app.leanscope.ai/ (avatar, top-right); in Terminal, run \`${edit(at)}\` and replace the old value between the quotes, save`,
      );
    }
    if (!readsEnv && result.ok) {
      say('–', client.id === 'claude-code'
        ? 'This probe used the environment variable; Claude Code uses the token from its plugin settings. If its servers still fail, run `/plugin configure agent-kit@leanscope`.'
        : 'This probe used the environment variable; a Local session uses the token typed into its dialog.');
    }
  }

  // 4. What the user does now.
  if (readsEnv && (next.length > 0 || !tokenSet)) {
    next.push(`then reload: ${RELOAD[client.id] ?? 'restart the client from a new terminal'}`);
  } else if (readsEnv && ok) {
    lines.push(
      `  This shell sees a working token. If ${client.name} still reports a 401 or a rejected token, it started before the variable was set: ${RELOAD[client.id] ?? 'restart it from a new terminal'}.`,
    );
  }
  if (next.length > 0) lines.push('', 'Next:', ...next.map((n, i) => `  ${i + 1}. ${n}`));
  return { ok, lines: lines.map((l) => l.replaceAll('<project>', context.project)) };
}

/** The leanscope-* servers (or, for Claude Code, the enabled plugin) a client's file registers. */
function registeredServers(clientId, text) {
  if (!text) return [];
  if (clientId === 'claude-code') {
    try {
      return JSON.parse(text)?.enabledPlugins?.[`${PLUGIN}@${MARKETPLACE}`] ? [PLUGIN] : [];
    } catch {
      return [];
    }
  }
  if (clientId === 'codex') {
    return SERVERS.map((s) => s.name).filter((n) => text.includes(`[mcp_servers.${n}]`));
  }
  return leanscopeEntries(text).map((e) => e.name);
}

/**
 * A command that opens `file` OUTSIDE VS Code: a file open in VS Code's editor is attached to the
 * chat as context, and with it every secret in it.
 */
function editCommand(file, env) {
  return process.platform === 'darwin' ? `open -e ${file}` : `${env.EDITOR || 'nano'} ${file}`;
}

/**
 * The value an interactive shell gets for `name` from the user's profile, or '' when it can't.
 * Held in memory for the probe only; never printed or returned to the caller's output.
 */
function profileValue(name, env) {
  const shell = env.SHELL || '/bin/zsh';
  const marker = '__LEANSCOPE_CHECK__';
  try {
    const result = spawnSync(shell, ['-i', '-c', `printf '\\n${marker}%s' "$${name}"`], {
      env: { ...env, [name]: '' },
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = result.stdout ?? '';
    const at = out.lastIndexOf(marker);
    return at >= 0 ? out.slice(at + marker.length).trim() : '';
  } catch {
    return '';
  }
}

/** The profile a new terminal reads, by login shell. */
function defaultProfile(home, env) {
  return join(home, (env.SHELL ?? '').endsWith('bash') ? '.bashrc' : '.zshrc');
}

/**
 * Ask leanscope-admin which repositories the token reaches: MCP `initialize`, then `tools/call`.
 * Returns { ok, rejected, text }. Never puts the token or the raw answer into `text`.
 */
export async function probe(endpoint, token, doFetch = globalThis.fetch) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  const call = async (id, method, params) => {
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(15000),
    });
    const session = response.headers.get('mcp-session-id');
    if (session) headers['mcp-session-id'] = session;
    const body = await response.text();
    return { status: response.status, message: parseMessage(body) };
  };

  try {
    const init = await call(1, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'leanscope-agent-kit-check', version: '1' },
    });
    const failed = classify(init);
    if (failed) return failed;
    const result = await call(2, 'tools/call', { name: 'get_credential_permissions', arguments: {} });
    const failedCall = classify(result);
    if (failedCall) return failedCall;
    const r = result.message?.result;
    const errorText = r?.content?.find((c) => c.type === 'text')?.text ?? '';
    if (r?.isError) {
      if (/did not accept/i.test(errorText)) {
        return { ok: false, rejected: true, text: 'rejected: LeanScope did not accept the token (wrong, expired or revoked).' };
      }
      return { ok: false, text: `the server couldn't check it: ${errorText.slice(0, 200)}` };
    }
    const ids = r?.structuredContent?.repositoryIds ?? safeJson(errorText)?.repositoryIds;
    if (Array.isArray(ids)) {
      return { ok: true, text: `ok, the token reaches repository ${ids.join(', ') || '(none)'}.` };
    }
    return { ok: false, text: 'unexpected answer from leanscope-admin.' };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'timed out' : error?.cause?.code ?? error?.message ?? 'failed';
    return { ok: false, text: `no connection to ${endpoint} (${reason}).` };
  }
}

function classify({ status, message }) {
  const error = message?.error?.message ?? '';
  if (status === 401 || status === 403) {
    return { ok: false, rejected: true, text: `rejected (HTTP ${status}): the token is wrong, expired or revoked.` };
  }
  if (status === 404 || /Unknown MCP channel/i.test(error)) {
    return { ok: false, text: 'the host has no admin channel (404 / "Unknown MCP channel"): nothing you can fix; tell the LeanScope team.' };
  }
  if (status >= 400) return { ok: false, text: `HTTP ${status} from leanscope-admin.` };
  if (message?.error) return { ok: false, text: `error from leanscope-admin: ${error.slice(0, 200)}` };
  return undefined;
}

/** A JSON-RPC message from a JSON body or the first `data:` line of an SSE body. */
function parseMessage(body) {
  const direct = safeJson(body);
  if (direct) return direct;
  const data = body.split('\n').find((l) => l.startsWith('data:'));
  return data ? safeJson(data.slice(5).trim()) : undefined;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
