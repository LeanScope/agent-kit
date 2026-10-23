// The one place that says which LeanScope MCP servers exist, where they live (dev or prod), and
// which secret each header carries. Every client writer renders this catalog in its own syntax.

/**
 * THE dev/prod switch, and the only one in the kit. There is no production stage yet, so it is
 * `dev.`; once production serves every channel, set it to `''`, then run
 * `node scripts/setup-mcp.mjs --clients claude-plugin` and `npm test` (the tests name any other
 * file that still points at the old stage).
 */
export const STAGE = 'dev.';

/** The MCP host. */
export const MCP_HOST = `https://${STAGE}mcp.leanscope.ai`;

/** The agent server's REST API docs (linked from the README). */
export const AGENT_API_DOCS = `https://${STAGE}api.agents.leanscope.ai/api/v1/docs`;

/** Where the kit lives on GitHub, and its Claude Code marketplace and plugin names. */
export const KIT_REPO = 'leanscope/agent-kit';
export const MARKETPLACE = 'leanscope';
export const PLUGIN = 'agent-kit';

/**
 * The secrets the servers need. `id` is how writers refer to one; `env` is the variable name for
 * clients that read the environment; `required` ones are always included, optional ones only when
 * asked for (see `selectedSecrets`).
 */
export const SECRETS = [
  {
    id: 'token',
    env: 'LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN',
    label: 'LeanScope personal team repos access token',
    required: true,
  },
  { id: 'openai', env: 'LEANSCOPE_OPENAI_API_KEY', label: 'OpenAI API key', required: false },
  { id: 'anthropic', env: 'LEANSCOPE_ANTHROPIC_API_KEY', label: 'Anthropic API key', required: false },
  { id: 'mistral', env: 'LEANSCOPE_MISTRAL_API_KEY', label: 'Mistral API key', required: false },
  { id: 'elevenlabs', env: 'LEANSCOPE_ELEVENLABS_API_KEY', label: 'ElevenLabs API key', required: false },
];

/** The optional keys a prompting client asks for unless told otherwise (each one is a dialog). */
export const DEFAULT_PROMPTED_KEYS = ['openai'];

const bearer = { secret: 'token', prefix: 'Bearer ' };
const key = (secret) => ({ secret, prefix: '' });

/** The servers, in the order they are written. Header order is kept too. */
export const SERVERS = [
  { name: 'leanscope-admin', path: '/mcp/admin', headers: { Authorization: bearer } },
  { name: 'leanscope-graphql', path: '/mcp/graphql-v2', headers: { Authorization: bearer } },
  {
    name: 'leanscope-agents',
    path: '/mcp/agents',
    headers: {
      Authorization: bearer,
      'X-LeanScope-Key-OpenAI': key('openai'),
      'X-LeanScope-Key-Anthropic': key('anthropic'),
      'X-LeanScope-Key-Mistral': key('mistral'),
      'X-LeanScope-Key-ElevenLabs': key('elevenlabs'),
    },
  },
];

export const secret = (id) => {
  const found = SECRETS.find((s) => s.id === id);
  if (!found) throw new Error(`unknown secret "${id}"`);
  return found;
};

export const url = (server) => `${MCP_HOST}${server.path}`;

/**
 * The secrets a config should reference: every required one plus the optional ones in `keys`
 * (`undefined` = all of them).
 */
export function selectedSecrets(keys) {
  return SECRETS.filter((s) => s.required || keys === undefined || keys.includes(s.id));
}

/**
 * Each server with its headers resolved through `reference(secret)` — the client's syntax for
 * "the value of this secret". Headers whose secret isn't selected are left out.
 */
export function renderServers(reference, keys) {
  const ids = new Set(selectedSecrets(keys).map((s) => s.id));
  return SERVERS.map((server) => ({
    name: server.name,
    url: url(server),
    headers: Object.fromEntries(
      Object.entries(server.headers)
        .filter(([, h]) => ids.has(h.secret))
        .map(([name, h]) => [name, `${h.prefix}${reference(secret(h.secret))}`]),
    ),
  }));
}
