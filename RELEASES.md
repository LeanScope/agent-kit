# Release notes

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
