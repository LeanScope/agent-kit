// For kit maintainers: the kit's root `mcp.json`, which VS Code reads from the installed plugin so
// the servers appear right after "Install Plugin". VS Code asks for each input (masked) when a
// server first starts. `node scripts/setup-mcp.mjs --clients vscode-plugin` regenerates it; a test
// fails when the committed file differs from the catalog.

import { join } from 'node:path';
import { DEFAULT_PROMPTED_KEYS, renderServers, selectedSecrets } from '../catalog.mjs';
import { parse, stringify } from '../json.mjs';

const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const inputId = (secret) => `leanscope-${secret.id}`;

export default {
  id: 'vscode-plugin',
  name: 'VS Code plugin mcp.json',
  target: ({ kit }) => join(kit, 'mcp.json'),

  render() {
    const secrets = selectedSecrets(DEFAULT_PROMPTED_KEYS);
    const inputs = secrets.map((s) => ({
      type: 'promptString',
      id: inputId(s),
      description: `${s.label}. ${s.help}`,
      password: true,
    }));
    const mcpServers = Object.fromEntries(
      renderServers((s) => `\${input:${inputId(s)}}`, DEFAULT_PROMPTED_KEYS).map(
        ({ name, url, headers }) => [name, { type: 'streamable-http', url, headers }],
      ),
    );
    return { inputs, mcpServers };
  },

  merge: (text, rendered, file) =>
    stringify({ $schema: SCHEMA, ...parse(text, file), ...rendered }),

  envSecrets: () => [],
  after: () => 'VS Code asks for the token (and the OpenAI key) when a server first starts.',
};
