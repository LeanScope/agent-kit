// Cursor: `.cursor/mcp.json` in the project. Cursor can't prompt, so headers reference the
// environment (`${env:…}`).

import { join } from 'node:path';
import { renderServers, selectedSecrets } from '../catalog.mjs';
import { mergeServers, parse, stringify } from '../json.mjs';

export default {
  id: 'cursor',
  name: 'Cursor',
  target: ({ project }) => join(project, '.cursor', 'mcp.json'),

  render: (options) =>
    Object.fromEntries(
      renderServers((s) => `\${env:${s.env}}`, options.keys).map(({ name, url, headers }) => [
        name,
        { url, headers },
      ]),
    ),

  merge: (text, servers, file) => stringify(mergeServers(parse(text, file), 'mcpServers', servers)),

  envSecrets: (options) => selectedSecrets(options.keys),
  after: () => 'Cursor reads the file and the variables when it next starts.',
};
