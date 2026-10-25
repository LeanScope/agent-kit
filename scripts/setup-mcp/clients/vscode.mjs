// VS Code, *Local* sessions (the Local harness, formerly "Agent"): `.vscode/mcp.json` in the
// project. `--secrets prompt` (default): VS Code asks for each secret once, with a masked dialog,
// and keeps it encrypted (`inputs` + `${input:…}`). `--secrets env`: `${env:…}` references.
// VS Code doesn't forward servers that need an input to *Copilot* sessions (the Copilot harness),
// which read the portable files instead: those need `copilot-cli`.

import { join } from 'node:path';
import { DEFAULT_PROMPTED_KEYS, renderServers, selectedSecrets } from '../catalog.mjs';
import { mergeServers, parse, stringify } from '../json.mjs';

const INPUT_PREFIX = 'leanscope-';
const inputId = (secret) => `${INPUT_PREFIX}${secret.id}`;

const keysFor = (options) =>
  options.keys ?? (options.secrets === 'env' ? undefined : DEFAULT_PROMPTED_KEYS);

export default {
  id: 'vscode',
  name: 'VS Code (Local sessions)',
  target: ({ project }) => join(project, '.vscode', 'mcp.json'),

  render(options) {
    const prompt = options.secrets !== 'env';
    const keys = keysFor(options);
    const reference = prompt ? (s) => `\${input:${inputId(s)}}` : (s) => `\${env:${s.env}}`;
    const servers = Object.fromEntries(
      renderServers(reference, keys).map(({ name, url, headers }) => [
        name,
        { type: 'http', url, headers },
      ]),
    );
    const inputs = prompt
      ? selectedSecrets(keys).map((s) => ({
          type: 'promptString',
          id: inputId(s),
          description: `${s.label}. ${s.help}`,
          password: true,
        }))
      : [];
    return { servers, inputs };
  },

  merge(text, { servers, inputs }, file) {
    const config = mergeServers(parse(text, file), 'servers', servers);
    // Our inputs are replaced as a set (switching to env removes them); everyone else's stay.
    const others = (config.inputs ?? []).filter((i) => !i.id?.startsWith(INPUT_PREFIX));
    const nextInputs = [...others, ...inputs];
    if (nextInputs.length > 0) config.inputs = nextInputs;
    else delete config.inputs;
    return stringify(config);
  },

  envSecrets: (options) => (options.secrets === 'env' ? selectedSecrets(keysFor(options)) : []),

  after: (options) =>
    (options.secrets === 'env'
      ? 'VS Code reads the variables from the environment it was started from: quit it and start it from a terminal (`code .`).'
      : 'In a Local session, MCP: List Servers → start each leanscope-* server: VS Code asks for the token (and each key) once, masked, and stores them encrypted.') +
    ' This covers Local sessions only. Copilot sessions (Session Target "Copilot") and Copilot CLI never show this prompt and skip these servers: they need --clients copilot-cli.',
};
