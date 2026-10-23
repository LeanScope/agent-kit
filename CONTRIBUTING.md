# Contributing to the LeanScope Agent Kit

This file is for changing the kit itself, whether you are a person or a coding agent. To use the
kit, start with the [README](README.md).

## Every change

- **Release notes.** Every change a kit user can notice gets an entry at the top of
  [RELEASES.md](RELEASES.md), written for kit users: what changed and what they have to do, if
  anything. Write the entry as part of the change, once it has been tested, not before.
- **Version.** These six manifests carry one version, and they change together (a test checks
  it):
  - `package.json` (only for `npx github:leanscope/agent-kit`, which runs the setup script; no
    dependencies, not published to npm)
  - `plugin.json` (Agent Plugins 1.0, read by VS Code and Copilot CLI: skills only)
  - `.claude-plugin/plugin.json`
  - `.claude-plugin/marketplace.json`
  - `.codex-plugin/plugin.json`
  - `.cursor-plugin/plugin.json`

  Raise the third number for fixes and small improvements, the second for new features or
  changed behaviour. The maintainer changes the first number. The RELEASES.md heading uses the
  same version.
- **Servers and host.** The MCP host, the servers and their secrets live in one place,
  `scripts/setup-mcp/catalog.mjs`. Dev or prod is one constant there, `STAGE`; no other file
  decides it. After changing the catalog, regenerate the Claude Code plugin manifest with
  `node scripts/setup-mcp.mjs --clients claude-plugin` (don't edit its `userConfig` or
  `mcpServers` by hand), then run the tests: they fail on any LeanScope service URL in the kit
  whose stage differs from `STAGE`, and name the file.
- **Tests.** `node --test 'scripts/**/*.test.mjs'` (no dependencies). Run them before every commit.
- **Documentation.** The README is the documentation. When a change makes something in it wrong,
  fix or remove that part. Add new sections only when the change needs them.

## Keep out of commits

- Tokens and API keys, real or example. `.env.example` lists names only, and a secret scan runs
  on every push.
- `tasks/`. It is gitignored and holds local plans and notes.
