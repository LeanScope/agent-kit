# Release notes

## 0.4.2 — 2026-10-30

- **New names: plugin `leanscope-agent-kit`, repository `leanscope/leanscope-agent-kit`.** Install
  with `/plugin marketplace add leanscope/leanscope-agent-kit` and
  `/plugin install leanscope-agent-kit@leanscope`; the setup command is now
  `npx -y github:leanscope/leanscope-agent-kit --clients <client>`. The old repository URL keeps
  working through GitHub's redirect.
  - **To do (Claude Code):** run `npx -y github:leanscope/leanscope-agent-kit --clients claude-code`
    once. It replaces `agent-kit@leanscope` in `.claude/settings.json` with the new id and points
    the marketplace at the new repository. Then run `/plugin uninstall agent-kit@leanscope` if the
    old plugin is still installed.
- **Starter template for Angular:**
  [leanscope-agent-kit-angular-quickstart](https://github.com/LeanScope/leanscope-agent-kit-angular-quickstart)
  is a repository to fork. It comes with the kit enabled and an Angular client for the agent
  server.

## 0.4.1 — 2026-10-26

- **Your token stays out of the chat.** The agent no longer reads your shell profile, not even to
  "check the spelling", and no longer tells you to open it in VS Code: a file open in VS Code's
  editor is attached to the chat, token included. To edit it, `--check` now gives you a Terminal
  command that opens it outside VS Code (`open -e ~/.zshrc` on macOS) and the exact lines to add.
  - **To do:** if your profile was open in VS Code while you chatted with an agent, or an agent
    showed its contents, revoke your LeanScope token and LLM keys and create new ones.
- **The client question is asked once per conversation.** After you answer it, the agent doesn't
  ask again, also not after "check again".
- **VS Code Copilot sessions: start VS Code from a terminal.** Opened from the Dock or Spotlight,
  VS Code doesn't hand your shell profile's variables to Copilot sessions, and LeanScope gets an
  empty token. Reload Window doesn't help either. `--check` now recognises this case (variable in
  the profile, not in the session), tests the token from your profile without printing it, and
  says what to do: quit VS Code (⌘Q), open a new Terminal window, run `code <project>`.

## 0.4.0 — 2026-10-26

- **The quickstart asks which client first.** Before it checks or changes anything, your agent
  asks which client the kit should work with (VS Code Local or Copilot session, Claude Code,
  Copilot CLI, Codex, Cursor) as one choice, with the one it detected suggested. It then sets up
  only that one.
- **No more question about the repository id.** The id comes from your token through
  `leanscope-admin`. If LeanScope rejects the token, the agent now says so for all three servers
  and helps you fix the token, instead of asking for an id that wouldn't work with that token
  anyway. It also no longer starts on your choreo while the token is rejected.
- **New: `--check` diagnoses the connection** without changing anything or printing a secret:
  `npx -y github:leanscope/agent-kit --check --clients <client>`. It shows whether the client's
  file registers the servers, whether the token is set and exported in your shell profile, and
  what LeanScope says to it (accepted with your repository, rejected, unreachable). It ends with
  the next steps as commands, such as `code ~/.zshrc`. The agent runs it for you and hands you one
  command or link instead of a path to go and look at.
- **New: `--clean-root` tidies a workspace-root `.mcp.json`.** It removes only the `leanscope-*`
  servers and inputs and deletes the file once nothing else is in it. The setup now also warns
  about an empty root `.mcp.json`, which an earlier cleanup could leave behind.
  - **To do:** if your project has an empty `.mcp.json` (`{"mcpServers": {}}`), delete it or run
    `npx -y github:leanscope/agent-kit --clean-root`.

## 0.3.2 — 2026-10-25

- **VS Code: the setup matches your session type.** VS Code's *Local* sessions read
  `.vscode/mcp.json` and ask for the token in a masked dialog. *Copilot* sessions (Session Target
  "Copilot") can't ask: VS Code doesn't hand them servers that need an input, so they read
  `~/.copilot/mcp-config.json` and your environment variables, like Copilot CLI. The quickstart now
  finds out which session you're in before it changes anything, sets up only that one
  (`--clients vscode` or `--clients copilot-cli`), and no longer promises the dialog in a Copilot
  session.
  - **To do:** if you use Copilot sessions in VS Code, ask your agent *"Set up LeanScope in this
    project."* again, set `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN` (and
    `LEANSCOPE_OPENAI_API_KEY`) in your shell profile, quit VS Code, start it from a terminal
    (`code .`) and open a new Copilot session.
- **The setup warns about duplicate or misnamed servers.** After writing, it reads (never changes)
  the workspace-root `.mcp.json`, `.vscode/mcp.json` and the Copilot user config, and warns when
  `leanscope-*` servers would load twice, when one references a variable that isn't in
  `.env.example` (such as a shortened alias), or when a header holds a literal value. It never
  prints a value.
  - **To do:** if you added a root `.mcp.json` with `leanscope-*` servers yourself, remove those
    entries (keep the others).
- **No more root `mcp.json` in the plugin.** 0.3.1 shipped one by mistake, so VS Code could list
  the `leanscope-*` servers twice. Update the plugin as the README describes.
- The quickstart's troubleshooting separates *not configured for this session* from
  *authentication or startup errors*, and says how to reload the servers in each client.

## 0.3.1 — 2026-10-25

- **VS Code: the agent runs the setup again.** 0.3.0 assumed the plugin's own `mcp.json` would
  connect the servers, but a plugin can't ask for a token (the Agent Plugins format has no
  `inputs`), so nothing was connected and the agent told you to start servers that didn't exist.
  The plugin is skills-only again; ask your agent *"Set up LeanScope in this project."* and it
  writes `.vscode/mcp.json`. Then **MCP: List Servers** → start the `leanscope-*` servers → enter
  your token in VS Code's masked dialog.
  - **To do:** update the plugin (VS Code doesn't do it on its own): run
    `git -C ~/.vscode/agent-plugins/github.com/LeanScope/agent-kit pull`, or uninstall and
    reinstall it, then reload the window. An old copy (0.1.x) still talks about
    `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN` and writes `${env:…}` servers.
- **Prompts say where to get your token** (app.leanscope.ai, avatar top-right), and which keys are
  optional.
- **The plugin is called "leanscope-agent-kit"** in VS Code's plugin list, with a description that
  starts "LeanScope Agent Kit" (VS Code shows the plugin's name, and the format has no title field).
- **The agent no longer interviews you before it's connected.** The quickstart and `model-a-choreo`
  skills now get the servers connected first.

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
- The token is called "personal team-repos access token" everywhere, as in LeanScope itself.
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
