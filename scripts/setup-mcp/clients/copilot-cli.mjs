// GitHub Copilot CLI, and VS Code's *Copilot* sessions (the Copilot harness, Session Target
// "Copilot", once called "Copilot CLI" sessions): the user-level `~/.copilot/mcp-config.json` (or
// `$COPILOT_HOME/mcp-config.json`), the portable format. Neither reads `.vscode/mcp.json`, and
// VS Code doesn't forward servers that need an input to Copilot sessions. Neither can prompt;
// they expand `${VAR}` in headers from the environment. Other servers in the file are kept.

import { join } from 'node:path';
import { renderServers, selectedSecrets } from '../catalog.mjs';
import { mergeServers, parse, stringify } from '../json.mjs';

// Optional keys fall back to empty, so an unset key sends no value rather than the literal text.
const reference = (s) => (s.required ? `\${${s.env}}` : `\${${s.env}:-}`);

export default {
  id: 'copilot-cli',
  name: 'Copilot (CLI and VS Code Copilot sessions)',
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
    'Both read the variables from the environment they start in, and there is no input prompt. Copilot CLI: start it from a new terminal. VS Code: quit it completely (⌘Q; reopening it from the Dock is not enough), start it from a new terminal (`code .`), then open a new Copilot session.',
};
