// For kit maintainers: the kit's OWN Claude Code plugin manifest, `.claude-plugin/plugin.json`.
// It declares every secret as a sensitive `userConfig` entry (Claude Code asks for them at install,
// masked, and keeps them in the OS credential store) and the servers inline in `mcpServers`, using
// `${user_config.<id>}`. The servers live inline, not in a root `.mcp.json`, because VS Code and
// Copilot CLI would load a root `.mcp.json` too and can't resolve `${user_config.…}`.
//
// `node scripts/setup-mcp.mjs --clients claude-plugin` regenerates it; a test fails when the
// committed file differs, so the host can't drift from the catalog.

import { join } from 'node:path';
import { SECRETS, renderServers } from '../catalog.mjs';
import { parse, stringify } from '../json.mjs';

export default {
  id: 'claude-plugin',
  name: 'Claude Code plugin',
  target: ({ kit }) => join(kit, '.claude-plugin', 'plugin.json'),

  render() {
    const userConfig = Object.fromEntries(
      SECRETS.map((s) => [
        s.id,
        {
          type: 'string',
          title: s.label,
          description: s.required
            ? `Names the LeanScope repository your choreos live in. Stored in your OS credential store.`
            : `Optional. Sent to the agent server per session, never stored there. Leave empty if your choreos don't use it.`,
          sensitive: true,
          required: s.required,
          ...(s.required ? {} : { default: '' }),
        },
      ]),
    );
    const mcpServers = Object.fromEntries(
      renderServers((s) => `\${user_config.${s.id}}`).map(({ name, url, headers }) => [
        name,
        { type: 'http', url, headers },
      ]),
    );
    return { userConfig, mcpServers };
  },

  merge: (text, rendered, file) => stringify({ ...parse(text, file), ...rendered }),

  envSecrets: () => [],
  after: () => 'Claude Code asks for the token and keys when the plugin is installed or updated.',
};
