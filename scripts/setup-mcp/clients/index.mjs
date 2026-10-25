// Every client the setup script can write for. A new client is one new file plus one line here.
//
// A client exports:
//   id, name                  how the CLI and its messages refer to it
//   target(context)           the file it writes ({ project, home, kit } → path)
//   render(options)           our part of the config ({ secrets, keys } → data)
//   merge(text, rendered, f)  the existing file's text (or undefined) + our part → new text
//   envSecrets(options)       the secrets it reads from the environment (for the missing check)
//   after(options)            one line on what happens next

import claudeCode from './claude-code.mjs';
import claudePlugin from './claude-plugin.mjs';
import codex from './codex.mjs';
import copilotCli from './copilot-cli.mjs';
import cursor from './cursor.mjs';
import vscode from './vscode.mjs';

export const CLIENTS = Object.fromEntries(
  [vscode, copilotCli, cursor, codex, claudeCode, claudePlugin].map((c) => [c.id, c]),
);
