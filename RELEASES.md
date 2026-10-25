# Release notes

## 0.3.0 — 2026-10-25

- **VS Code connects the servers when you install the plugin.** The plugin's `mcp.json` brings the
  three `leanscope-*` servers, and VS Code asks for your personal team repos access token (and
  your OpenAI key) in a masked dialog when a server first starts. No setup script, no environment
  variables. The prompts now say where to get the token: https://app.leanscope.ai/, via your
  avatar (top-right).
  - **To do:** if you installed the plugin in VS Code before, update it. VS Code doesn't do that
    on its own: run `git -C ~/.vscode/agent-plugins/github.com/LeanScope/agent-kit pull` (or
    uninstall and reinstall the plugin), then reload the window. An old copy (0.1.x) still talks
    about `LEANSCOPE_ACCESS_TOKEN` and writes `${env:…}` servers.
  - **To do:** delete a `.vscode/mcp.json` that an earlier setup wrote, or the servers show up
    twice.
- **The plugin is called "leanscope-agent-kit"** in VS Code's plugin list, with a description that
  starts "LeanScope Agent Kit" (VS Code shows the plugin's name, and the format has no title field).
- **No double servers.** With the plugin installed, `setup-mcp.mjs --clients vscode` writes nothing
  and removes the kit's entries from an existing `.vscode/mcp.json`.
- **The agent no longer interviews you before it's connected.** The quickstart and `model-a-choreo`
  skills now get the servers connected first, and in VS Code send you to **MCP: List Servers**
  instead of writing a config.
- The kit's root `mcp.json` is generated from the server catalog
  (`node scripts/setup-mcp.mjs --clients vscode-plugin`), and a test fails when it drifts.

## 0.2.1 — 2026-10-23

- **No clone needed for the setup.** `npx -y github:leanscope/agent-kit --clients <client>` runs
  the setup script in your project. And you don't have to run it yourself: after installing the
  plugin, ask your agent *"Set up LeanScope in this project."* The quickstart skill now runs the
  setup for you instead of handing you a command.
- **Claude Code in VS Code.** The README now says that a plugin installed for Copilot in VS Code
  doesn't reach the Claude Code extension. `--clients claude-code` enables the kit's plugin in the
  project's `.claude/settings.json`, so Claude Code offers to install it on the next start.
- **Updating the VS Code plugin.** VS Code doesn't update installed plugins on its own; the README
  says how. An old 0.1.x plugin brings its own servers, which show up twice or report "Unknown MCP
  channel". The quickstart now recognises that error.
  - **To do:** if you installed the plugin in VS Code before 0.2.0, update it as the README
    describes.
- `--clients vscode` now reminds you that *Copilot CLI* sessions need `--clients copilot-cli`.
- The token is called "personal team repos access token" everywhere, as in LeanScope itself.
  Claude Code shows the new name when it asks for it.

## 0.2.0 — 2026-10-23

- **Claude Code asks for your token and keys.** The plugin now prompts for them when you install
  or update it, masked, and keeps them in your OS credential store. Environment variables are no
  longer read there.
  - **To do:** update the plugin and enter the token (and the keys you use) when asked, or later
    with `/plugin configure agent-kit@leanscope`.
- **VS Code asks too.** `setup-mcp.mjs --clients vscode` now writes prompts (`inputs`) for the
  token and the OpenAI key instead of `${env:…}`. VS Code asks once and stores them encrypted. Add
  other keys with `--keys openai,anthropic,…`; keep the old behaviour with `--secrets env`.
  - **To do:** rerun `node <path-to-agent-kit>/scripts/setup-mcp.mjs --project . --clients vscode`.
- **Copilot CLI is supported.** `--clients copilot-cli` writes `~/.copilot/mcp-config.json`. That's
  also the setup for the *Copilot CLI* session type in VS Code, which doesn't read
  `.vscode/mcp.json`.
- **No more duplicate servers in VS Code.** VS Code and Copilot CLI now get the plugin's skills
  only; their servers come from `setup-mcp.mjs`. The kit's root `.mcp.json` is gone.
- `--vendors` is now `--clients`. The old name still works in this release.
- The quickstart uses a repository id you name. When `leanscope-admin` can't be reached, it asks
  you for the id once instead of stopping, and it tells you which server failed and why.

## 0.1.1 — 2026-10-23

- **One LeanScope variable.** Setup needs only `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`, a repository access
  token. The agent works out the repository from the token, so `LEANSCOPE_REPOSITORY_ID` is gone.
  `LEANSCOPE_MCP_URL` is gone too: the kit always connects to `https://dev.mcp.leanscope.ai`.
  - **To do:** remove both variables from your environment, then rerun
    `scripts/setup-mcp.mjs` for your agent as the README describes (or update the plugin) to pick
    up the new `leanscope-admin` server.
- The Codex and Cursor plugins now carry the same version as the Claude Code plugin.

## 0.1.0

- First release: the `leanscope-quickstart`, `model-a-choreo`, `run-a-choreo` and
  `write-a-worker` skills, MCP setup for Claude Code, Codex, Cursor and VS Code.
