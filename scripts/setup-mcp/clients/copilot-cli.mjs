// GitHub Copilot CLI, including the "Copilot CLI" session type inside VS Code: the user-level
// `~/.copilot/mcp-config.json` (or `$COPILOT_HOME/mcp-config.json`). It does NOT read
// `.vscode/mcp.json`. Copilot CLI can't prompt; it expands `${VAR}` in headers from the
// environment. Other servers in the file are kept.

import { join } from 'node:path';
import { renderServers, selectedSecrets } from '../catalog.mjs';
import { mergeServers, parse, stringify } from '../json.mjs';

// Optional keys fall back to empty, so an unset key sends no value rather than the literal text.
const reference = (s) => (s.required ? `\${${s.env}}` : `\${${s.env}:-}`);

export default {
  id: 'copilot-cli',
  name: 'Copilot CLI',
  target: ({ home }) => join(process.env.COPILOT_HOME || join(home, '.copilot'), 'mcp-config.json'),

  render: (options) =>
    Object.fromEntries(
      renderServers(reference, options.keys).map(({ name, url, headers }) => [
        name,
        { type: 'http', url, headers, tools: ['*'] },
      ]),
    ),

  merge: (text, servers, file) => stringify(mergeServers(parse(text, file), 'mcpServers', servers)),

  envSecrets: (options) => selectedSecrets(options.keys),
  after: () =>
    'Copilot CLI reads the variables from the shell it starts in; in VS Code, restart VS Code from a new terminal.',
};
