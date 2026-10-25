---
name: leanscope-quickstart
description: Use first whenever the user mentions LeanScope, choreos, personas talking to humans, or this agent kit — or when a leanscope MCP tool is missing or failing. Checks the connection, explains the pieces, and routes to model-a-choreo, run-a-choreo or write-a-worker.
---

# LeanScope quickstart

LeanScope runs **choreos**: scripted conversations between AI personas and a human — an interview,
an onboarding, a panel discussion — authored as data in a LeanScope repository and run by the
hosted agent server. This kit lets you, a coding agent, do three things for the user:

| The user wants to…                                   | Skill            | MCP server          |
| ---------------------------------------------------- | ---------------- | ------------------- |
| create or change a choreo, its personas or questions | `model-a-choreo` | `leanscope-graphql` |
| try it out, answer it turn by turn, debug it         | `run-a-choreo`   | `leanscope-agents`  |
| let a step call their own code                       | `write-a-worker` | both                |

Everything runs **as the user**: their LeanScope repository, their personal team repos access
token, their own LLM keys.
Nothing is billed to anyone else, and the engine never stores their keys.

## 1. Check the connection, server by server

Check each server on its own and report each one by name. Never say just "the tools aren't
available".

| Server              | Connected when you can call…  |
| ------------------- | ----------------------------- |
| `leanscope-admin`   | `get_credential_permissions`  |
| `leanscope-graphql` | `search_schema`               |
| `leanscope-agents`  | `session_start`               |

Each server is in one of three states:

- **connected**: its tool answers.
- **not configured in this client**: its tools aren't there at all. Go to step 2.
- **configured but failing**: the tool exists but the call fails. Name the cause:
  - **401**: the token is missing or wrong (step 2, secrets).
  - **"Unknown MCP channel … Configured channels: default"** (often for all three servers at
    once): the server is reachable, but the host it points at doesn't serve the kit's channels.
    Almost always an outdated configuration: an old plugin install or an old setup still pointing
    at another host. Fix it as in step 2 (update the plugin, rerun the setup). In VS Code, also
    check whether the `leanscope-*` servers are listed twice (see step 2).
  - **404 / "Unknown MCP channel"** for one server only, with a current setup: that channel isn't
    deployed on the host. Nothing the user can fix. Say so and carry on with the other servers.
  - **network error / timeout**: the host isn't reachable from here.

You don't need all three to make progress. `leanscope-graphql` alone is enough to read and model
a choreo once you have the repository id (step 3). `leanscope-agents` is needed only to run one.

If all three are connected, go to step 3.

**Until `leanscope-graphql` is connected, don't start the user's actual task.** Don't ask what the
choreo should do, who it is for, or anything else about it: that is wasted effort while nothing can
be written. Fix the connection first (step 2), then ask.

## 2. Fix what is missing

**Never ask the user to paste a token or key into the chat**, and never write one into a file. Tell
them where the client takes it.

First find out **which client and which session type** you are running in, if you can't tell. GitHub
Copilot in VS Code has two session types with separate setups: *Agent* (local, reads
`.vscode/mcp.json`) and *Copilot CLI* (reads `~/.copilot/mcp-config.json`, never
`.vscode/mcp.json`). If you are a Copilot CLI session and have no `leanscope-*` tools, say so: "this
is a Copilot CLI session, which doesn't read `.vscode/mcp.json`", then fix it with `copilot-cli`.

**VS Code with the kit's plugin installed: don't run the setup.** The plugin brings the three servers
itself and VS Code asks for the token in a masked dialog when a server starts. If the tools are
missing, the servers just haven't started or the user hasn't answered the dialog: tell them to open
the Command Palette → **MCP: List Servers**, start the `leanscope-*` servers and enter the token.
If that doesn't help, the installed plugin is outdated (see below). Never write `.vscode/mcp.json`
for them, and never ask for secrets to be put in the environment for VS Code.

**Run the setup yourself; don't hand the user a command.** It writes references to the secrets,
never a secret, and keeps every other server in the file. Tell the user which file it wrote. Run it
from the user's project folder (it is the default `--project`):

- If this skill sits in a full copy of the kit (a plugin install or a clone), the script is
  `../../scripts/setup-mcp.mjs`, relative to this `SKILL.md`:
  `node <that path> --clients <id>`.
- Otherwise, with no copy of the kit at hand: `npx -y github:leanscope/agent-kit --clients <id>`.

| Client                        | `--clients`   | What it writes, and what happens next                                                                                                                                               | Secrets                                                                                                       |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Claude Code (CLI or VS Code extension) | `claude-code` | `.claude/settings.json`: enables the kit's plugin, which brings the servers. Claude Code offers the install on the next session start (you can't run `/plugin` yourself). | asked at install, kept in the OS credential store; changed with `/plugin configure agent-kit@leanscope` |
| VS Code, *Agent* sessions, plugin not installed | `vscode`      | `.vscode/mcp.json` (with the plugin installed, it writes nothing and removes its own old entries)                                                                                                                                                                    | VS Code asks once when a server starts and stores them encrypted                                              |
| Copilot CLI (also in VS Code) | `copilot-cli` | `~/.copilot/mcp-config.json`, for every project                                                                                                                                       | environment variables                                                                                         |
| Codex                         | `codex`       | `.codex/config.toml` (read in trusted projects only)                                                                                                                                  | environment variables                                                                                         |
| Cursor                        | `cursor`      | `.cursor/mcp.json`                                                                                                                                                                    | environment variables                                                                                         |

A plugin installed in **VS Code does not cover Claude Code** in the same editor, and the other way
round: each has its own install.

**Servers listed twice in VS Code, or "Unknown MCP channel" for all three:** an old copy of the kit's
VS Code plugin (0.1.x) still brings its own `leanscope-*` servers, and VS Code doesn't update plugins
on its own. Tell the user to update it (README, *GitHub Copilot in VS Code*), then reload the
window.

Where a client reads the environment, these are the variables (`.env.example` lists them). They go
in the shell profile (`~/.zshrc`, `~/.bashrc`), and the client is then restarted from a new
terminal. A project `.env` is not read by any MCP client.

| Variable                                                                                                               | What                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`                                                                           | their LeanScope personal team repos access token                  |
| `LEANSCOPE_OPENAI_API_KEY`, `LEANSCOPE_ANTHROPIC_API_KEY`, `LEANSCOPE_MISTRAL_API_KEY`, `LEANSCOPE_ELEVENLABS_API_KEY` | their own LLM keys; at least one completion model to run a choreo |

After a change to the MCP configuration, the client has to reload its servers (a new session, or a
restart) before the tools show up.

## 3. Get the repository id

Pass the id as `repositoryId` to every `leanscope-graphql` tool. In this order:

1. **The user named one** ("repository 2067"): use it. Don't call `leanscope-admin` for it.
2. Otherwise call `get_credential_permissions` on `leanscope-admin` once. A personal team repos
   access token returns one repository id.
3. If `leanscope-admin` isn't reachable, ask the user for the id **once**, and say why ("I can't
   reach leanscope-admin: <cause>, so I can't look it up"). Then carry on.

## 4. Find out what they want

Ask what the choreo should achieve, for whom, and whether one exists already. If they have one, find
it: with `leanscope-graphql`, list the repository's scenarios by name (`search_schema` first, then
`query_graphql`) and let the user pick. Then hand over to the matching skill above.

## Verify

Before handing over: you have a repository id, `search_schema` returns entries, the user knows the
state of each server you checked (and the cause for any that failed), and they know which choreo
(scenario `_guid`) you are working on.
