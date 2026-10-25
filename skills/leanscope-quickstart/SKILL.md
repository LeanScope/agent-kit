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

Everything runs **as the user**: their LeanScope repository, their personal team-repos access
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

Each server is in one of three states. Tell the user which one, because the fixes differ:

- **connected**: its tool answers.
- **not configured in this client**: its tools aren't there at all. This is missing
  configuration *for the session you are in*, even if a file elsewhere lists the server (a VS Code
  Copilot session skips `.vscode/mcp.json` servers that need an input). Go to step 2.
- **configured but failing**: the tool exists, or the client lists the server, but the call or the
  start fails. That's authentication or startup, not missing configuration: don't run the setup
  again, and don't add a second configuration. Name the cause:
  - **401**, or a server that won't start because a variable is empty: the token is missing or
    wrong where this client reads it (step 2, *Secrets*).
  - **the literal text `${input:…}` or `${…}` in an error, or "unsupported" next to the server**:
    the client can't resolve that reference. You are in a session that doesn't prompt (step 2).
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

### Which client and session are you in?

Decide this **before you change any MCP configuration**. Each client and session type reads its own
file, and only some of them can ask for a secret:

| You are running in                                                         | `--clients`   | It reads                                                                 | Masked prompt for secrets? |
| -------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ | -------------------------- |
| Claude Code (CLI or VS Code extension)                                     | `claude-code` | the kit's plugin (enabled in `.claude/settings.json`)                    | yes, at plugin install     |
| VS Code, **Local** session (Session Target "Local"; once called *Agent*)   | `vscode`      | `.vscode/mcp.json` (`servers`, `${input:…}`)                             | yes, when a server starts  |
| VS Code, **Copilot** session (Session Target "Copilot", the Copilot harness; once called *Copilot CLI*) | `copilot-cli` | `~/.copilot/mcp-config.json` (`mcpServers`, `${VAR}`). VS Code doesn't forward `.vscode/mcp.json` servers that need an input | **no**: environment variables |
| Copilot CLI in a terminal                                                  | `copilot-cli` | `~/.copilot/mcp-config.json`; never `.vscode/mcp.json`                   | **no**: environment variables |
| Codex                                                                      | `codex`       | `.codex/config.toml` (trusted projects only)                             | no: environment variables  |
| Cursor                                                                     | `cursor`      | `.cursor/mcp.json`                                                       | no: environment variables  |

How to tell: your own system prompt or tool list usually names the client and harness. In VS Code,
the chat's **Session Target** control shows Local, Copilot, Claude, Codex or Cloud. If you still
can't tell, ask the user **once** which one the control shows. Don't guess, and don't set up
several clients "to be safe": every extra file is a second registration of the same servers.

Then:

- Set up **only the matching client**. If the user also uses another session type, say so and ask
  before adding a second client.
- **Never promise VS Code's masked dialog** unless you are in a VS Code Local session. In a Copilot
  session, a `.vscode/mcp.json` with `${input:…}` can't work, however often it is restarted: say
  "this is a VS Code Copilot session, which can't ask for the token; it reads
  `~/.copilot/mcp-config.json` and your environment variables", then set up `copilot-cli`.
- **Never create a workspace-root `.mcp.json`** or any other file by hand to work around a missing
  prompt. The setup script writes the right file for each client. If one already holds
  `leanscope-*` servers, the script warns: show the user those entries and, once they agree,
  remove only the `leanscope-*` servers (and `leanscope-*` inputs) from it. Keep everything else.
- **Never invent variable names**: no shorter aliases, no names without the `LEANSCOPE_` prefix.
  Use exactly the ones under *Secrets* below (from `.env.example`). The script warns about any
  other name.

### Run the setup

**Run the setup yourself; don't hand the user a command.** It writes references to the secrets,
never a secret, and keeps every other server in the file. Tell the user which file it wrote, and
relay its `!` warnings. Run it from the user's project folder (it is the default `--project`). Add
`--dry-run` first when the file already exists, to preview the change:

- If this skill sits in a full copy of the kit (a plugin install or a clone), the script is
  `../../scripts/setup-mcp.mjs`, relative to this `SKILL.md`:
  `node <that path> --clients <id>`.
- Otherwise, with no copy of the kit at hand: `npx -y github:leanscope/agent-kit --clients <id>`.

For Claude Code, `claude-code` enables the kit's plugin, which brings the servers. Claude Code offers
the install on the next session start (you can't run `/plugin` yourself), asks for the secrets and
keeps them in the OS credential store; `/plugin configure agent-kit@leanscope` changes them.

A plugin installed in **VS Code does not cover Claude Code** in the same editor, and the other way
round: each has its own install.

**Servers listed twice in VS Code, or "Unknown MCP channel" for all three:** either two files
register them (the setup script names both; keep the one for the user's session type), or an old
copy of the kit's VS Code plugin still brings its own `leanscope-*` servers: 0.1.x, or the 0.3.1
build that shipped a root `mcp.json` by mistake. VS Code doesn't update plugins on its own. Tell
the user to update it (README, *GitHub Copilot in VS Code*), then reload the window.

### Secrets

Where a client reads the environment, these are the variables, exactly as `.env.example` names
them. The user puts them in their shell profile (`~/.zshrc`, `~/.bashrc`) themselves; you never see
or write the values. A project `.env` is not read by any MCP client.

| Variable                                                                                                               | What                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`                                                                           | their LeanScope personal team-repos access token                  |
| `LEANSCOPE_OPENAI_API_KEY`, `LEANSCOPE_ANTHROPIC_API_KEY`, `LEANSCOPE_MISTRAL_API_KEY`, `LEANSCOPE_ELEVENLABS_API_KEY` | their own LLM keys; at least one completion model to run a choreo |

### Reload the servers

After a change to the MCP configuration or to the variables, the tools show up only once the client
reloads its servers. Tell the user the step for **their** client:

| Client                  | After a config change                                                                                         | After setting or changing a variable                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Claude Code             | start a new session (accept the plugin install); `/mcp` shows the servers                                     | none needed; `/plugin configure agent-kit@leanscope`, then a new session                    |
| VS Code, Local session  | Command Palette → **MCP: List Servers** → each `leanscope-*` server → **Start** (or **Restart**); enter the token in the masked dialog | — (prompted). A server that fails: **MCP: List Servers** → server → **Show Output**        |
| VS Code, Copilot session | open a new Copilot session                                                                                   | quit VS Code, start it from a new terminal (`code .`), open a new Copilot session           |
| Copilot CLI             | start a new `copilot` session; `/mcp` shows the servers                                                       | open a new terminal, then start `copilot` again                                             |
| Codex, Cursor           | restart the client                                                                                            | restart it from a new terminal                                                              |

Then check the servers again (step 1). Still no tools → configuration is missing for this session:
recheck which session you are in. Tools there but failing → authentication or startup: check the
variable or the token, not the configuration.

## 3. Get the repository id

Pass the id as `repositoryId` to every `leanscope-graphql` tool. In this order:

1. **The user named one** ("repository 2067"): use it. Don't call `leanscope-admin` for it.
2. Otherwise call `get_credential_permissions` on `leanscope-admin` once. A personal team-repos
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
