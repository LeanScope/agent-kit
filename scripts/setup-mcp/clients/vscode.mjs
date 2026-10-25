// VS Code, GitHub Copilot *Agent* sessions: `.vscode/mcp.json` in the project.
// `--secrets prompt` (default): VS Code asks for each secret once, with a masked dialog, and keeps
// it encrypted (`inputs` + `${input:…}`). `--secrets env`: `${env:…}` references.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PROMPTED_KEYS, renderServers, selectedSecrets } from '../catalog.mjs';
import { mergeServers, parse, stringify } from '../json.mjs';

const INPUT_PREFIX = 'leanscope-';
const inputId = (secret) => `${INPUT_PREFIX}${secret.id}`;

const keysFor = (options) =>
  options.keys ?? (options.secrets === 'env' ? undefined : DEFAULT_PROMPTED_KEYS);

// The kit's VS Code plugin brings the servers itself (its `mcp.json`); a second copy in the project
// would list every server twice.
const pluginInstalled = (home) => {
  try {
    const file = join(home, '.vscode', 'agent-plugins', 'installed.json');
    if (!existsSync(file)) return false;
    return (JSON.parse(readFileSync(file, 'utf8')).installed ?? []).some((p) =>
      /leanscope\/agent-kit/i.test(`${p.marketplace} ${p.pluginUri}`),
    );
  } catch {
    return false;
  }
};

export default {
  id: 'vscode',
  name: 'VS Code (Copilot Agent)',
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
          description: s.label,
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

  // Skipped, and our entries removed from an existing file, when the plugin brings the servers.
  superseded: (options, { home }) => options.secrets !== 'env' && pluginInstalled(home),

  retire(text, file) {
    const config = parse(text, file);
    for (const name of Object.keys(config.servers ?? {})) {
      if (name.startsWith('leanscope-')) delete config.servers[name];
    }
    if (config.servers && Object.keys(config.servers).length === 0) delete config.servers;
    const inputs = (config.inputs ?? []).filter((i) => !i.id?.startsWith(INPUT_PREFIX));
    if (inputs.length > 0) config.inputs = inputs;
    else delete config.inputs;
    return Object.keys(config).length === 0 ? undefined : stringify(config);
  },

  envSecrets: (options) => (options.secrets === 'env' ? selectedSecrets(keysFor(options)) : []),

  after: (options) =>
    (options.secrets === 'env'
      ? 'VS Code reads the variables from the environment it was started from: start it from a terminal (`code .`).'
      : 'VS Code asks for the token (and each key) once, when a server first starts, and stores them encrypted.') +
    ' This covers Copilot *Agent* sessions only; Copilot CLI sessions need --clients copilot-cli.',
};
