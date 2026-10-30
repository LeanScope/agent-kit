// Claude Code (CLI and the VS Code extension): `.claude/settings.json` in the project. The plugin
// brings the servers and asks for the secrets itself, so this only registers the kit's marketplace
// and enables the plugin. Claude Code then offers to install it when a session starts in the
// project. That's the way for an agent, which can't run `/plugin` itself. Other settings are kept.

import { join } from 'node:path';
import { KIT_REPO, MARKETPLACE, PLUGIN } from '../catalog.mjs';
import { parse, stringify } from '../json.mjs';

/** The plugin id before 0.4.2. Removed on setup so a project doesn't enable the kit twice. */
const LEGACY_PLUGIN = `agent-kit@${MARKETPLACE}`;

export default {
  id: 'claude-code',
  name: 'Claude Code',
  target: ({ project }) => join(project, '.claude', 'settings.json'),

  render: () => ({
    marketplace: { source: { source: 'github', repo: KIT_REPO } },
    plugin: `${PLUGIN}@${MARKETPLACE}`,
  }),

  merge(text, { marketplace, plugin }, file) {
    const settings = parse(text, file);
    const { [LEGACY_PLUGIN]: _legacy, ...enabledPlugins } = settings.enabledPlugins ?? {};
    return stringify({
      ...settings,
      // Overwriting the marketplace entry also moves projects off the old leanscope/agent-kit repo.
      extraKnownMarketplaces: { ...(settings.extraKnownMarketplaces ?? {}), [MARKETPLACE]: marketplace },
      enabledPlugins: { ...enabledPlugins, [plugin]: true },
    });
  },

  envSecrets: () => [],
  after: () =>
    `Claude Code offers to install the plugin when you next start a session in this project. If it doesn't ask for the token, run /plugin configure ${PLUGIN}@${MARKETPLACE}.`,
};
