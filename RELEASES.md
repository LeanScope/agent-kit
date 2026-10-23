# Release notes

## 0.1.1 — 2026-10-23

- **One LeanScope variable.** Setup needs only `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`, a repository access
  token. The agent works out the repository from the token, so `LEANSCOPE_REPOSITORY_ID` is gone.
  `LEANSCOPE_MCP_URL` is gone too: the kit always connects to `https://mcp.leanscope.ai`.
  - **To do:** remove both variables from your environment, then rerun
    `scripts/setup-mcp.mjs` for your agent as the README describes (or update the plugin) to pick
    up the new `leanscope-admin` server.
- The Codex and Cursor plugins now carry the same version as the Claude Code plugin.

## 0.1.0

- First release: the `leanscope-quickstart`, `model-a-choreo`, `run-a-choreo` and
  `write-a-worker` skills, MCP setup for Claude Code, Codex, Cursor and VS Code.
