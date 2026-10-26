---
name: leanscope-quickstart
description: Use first whenever the user mentions LeanScope, choreos, personas talking to humans, or this agent kit — or when a leanscope MCP tool is missing or failing. Asks which client the kit is for, checks the connection, explains the pieces, and routes to model-a-choreo, run-a-choreo or write-a-worker.
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

Two rules for the whole skill:

- **Diagnose it yourself, then hand over one action.** Run the checks below yourself. When the user
  has to do something, give them **one command to run or one link to click** (`code ~/.zshrc`, a
  markdown link to the file), never "go and look in directory X".
- **Never ask for the repository id.** The token decides the repository (step 3).

## 0. Which client and session are you in?

**Ask this first, every time, before anything else**: one question, a single choice, with what you
detected marked as *(suggested)*. Use the client's choice dialog where it has one. Your system
prompt or tool list usually names the client; in VS Code, the chat's **Session Target** control
shows Local, Copilot, Claude, Codex or Cloud. Detection alone has been wrong before, and one click
costs the user nothing.

> Which client should the kit work with?
> VS Code, Local session · VS Code, Copilot session · Claude Code (CLI or VS Code extension) ·
> Copilot CLI in a terminal · Codex · Cursor

Each choice is one `--clients` id, one file and one way to get the secrets:

| You are running in                                                         | `--clients`   | It reads                                                                 | Masked prompt for secrets? |
| -------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ | -------------------------- |
| Claude Code (CLI or VS Code extension)                                     | `claude-code` | the kit's plugin (enabled in `.claude/settings.json`)                    | yes, at plugin install     |
| VS Code, **Local** session (Session Target "Local"; once called *Agent*)   | `vscode`      | `.vscode/mcp.json` (`servers`, `${input:…}`)                             | yes, when a server starts  |
| VS Code, **Copilot** session (Session Target "Copilot", the Copilot harness; once called *Copilot CLI*) | `copilot-cli` | `~/.copilot/mcp-config.json` (`mcpServers`, `${VAR}`). VS Code doesn't forward `.vscode/mcp.json` servers that need an input | **no**: environment variables |
| Copilot CLI in a terminal                                                  | `copilot-cli` | `~/.copilot/mcp-config.json`; never `.vscode/mcp.json`                   | **no**: environment variables |
| Codex                                                                      | `codex`       | `.codex/config.toml` (trusted projects only)                             | no: environment variables  |
| Cursor                                                                     | `cursor`      | `.cursor/mcp.json`                                                       | no: environment variables  |

Work with **only that client** from here on. Every extra file is a second registration of the same
servers. If the user also uses another session type, say so and ask before adding a second client.

## 1. Check the connection

Check each server on its own and report each one by name. Never say just "the tools aren't
available".

| Server              | Connected when…                                                                  |
| ------------------- | -------------------------------------------------------------------------------- |
| `leanscope-admin`   | `get_credential_permissions` returns `repositoryIds`                              |
| `leanscope-graphql` | `search_schema` answers **and** admin accepted the token (see below)              |
| `leanscope-agents`  | `session_start` is there                                                         |

**`get_credential_permissions` is the token check for all three servers.** They all send the same
personal team-repos access token. `search_schema` answers even when that token is wrong, so on its
own it proves only that `leanscope-graphql` is reachable, not that it can read the repository. If
admin says the token is rejected (401/403, "LeanScope did not accept the token"), say so **once
for all three servers**: "the token is missing or rejected". Then go to step 2. Don't ask for a
repository id, because a repository needs a token graphql accepts.

Each server is in one of three states. Tell the user which one, because the fixes differ:

- **connected**: as in the table.
- **not configured in this client**: its tools aren't there at all. This is missing
  configuration *for the session you are in*, even if a file elsewhere lists the server (a VS Code
  Copilot session skips `.vscode/mcp.json` servers that need an input). Go to step 2, *Run the
  setup*.
- **configured but failing**: the tool exists, or the client lists the server, but the call or the
  start fails. That's authentication or startup, not missing configuration: don't run the setup
  again, and don't add a second configuration. Run `--check` (step 2) and name the cause:
  - **401/403, a rejected token, or a server that won't start because a variable is empty**: the
    token is missing or wrong where this client reads it (step 2, *Secrets*).
  - **the literal text `${input:…}` or `${…}` in an error, or "unsupported" next to the server**:
    the client can't resolve that reference. You are in a session that doesn't prompt: recheck
    step 0.
  - **"Unknown MCP channel … Configured channels: default"** (often for all three servers at
    once): the server is reachable, but the host it points at doesn't serve the kit's channels.
    Almost always an outdated configuration: an old plugin install or an old setup still pointing
    at another host. Update the plugin and rerun the setup. In VS Code, also check whether the
    `leanscope-*` servers are listed twice (see step 2).
  - **404 / "Unknown MCP channel"** for one server only, with a current setup: that channel isn't
    deployed on the host. Nothing the user can fix. Say so and carry on with the other servers.
  - **network error / timeout**: the host isn't reachable from here.

`leanscope-graphql` with an accepted token is enough to read and model a choreo.
`leanscope-agents` is needed only to run one.

**Until the token is accepted, don't start the user's actual task.** Don't ask what the choreo
should do, who it is for, or anything else about it: that is wasted effort while nothing can be
read or written. Fix the connection first (step 2), then ask.

## 2. Fix what is missing

**Never ask the user to paste a token or key into the chat**, and never write one into a file.

### Diagnose first: `--check`

Run it yourself, for the client from step 0. It is read-only and never prints a value:

```sh
node <kit>/scripts/setup-mcp.mjs --check --clients <id>
```

(`<kit>` is two folders up from this `SKILL.md`. Without a copy of the kit:
`npx -y github:leanscope/agent-kit --check --clients <id>`.)

It reports: whether the client's file registers the three servers, whether each variable is set in
this shell and exported in a shell profile (yes/no, the name only), and what `leanscope-admin` says
to that token (ok and the repository, rejected, channel missing, no connection). Then it lists the
next steps as commands. **Relay its findings in one or two sentences and pass on its `Next:` steps
as they are**: they are already commands the user can run or files they can open.

A new shell reads the user's profile, so "this shell" may see a variable that the client, started
earlier, doesn't have. If `--check` says the token works but the client still gets a 401, the
client needs the reload step (below), not a new token.

### Run the setup

When step 1 found a server **not configured**, **run the setup yourself; don't hand the user a
command.** It writes references to the secrets, never a secret, and keeps every other server in the
file. Tell the user which file it wrote, and relay its `!` warnings. Run it from the user's project
folder (it is the default `--project`). Add `--dry-run` first when the file already exists, to
preview the change:

- If this skill sits in a full copy of the kit (a plugin install or a clone), the script is
  `../../scripts/setup-mcp.mjs`, relative to this `SKILL.md`:
  `node <that path> --clients <id>`.
- Otherwise, with no copy of the kit at hand: `npx -y github:leanscope/agent-kit --clients <id>`.

For Claude Code, `claude-code` enables the kit's plugin, which brings the servers. Claude Code offers
the install on the next session start (you can't run `/plugin` yourself), asks for the secrets and
keeps them in the OS credential store; `/plugin configure agent-kit@leanscope` changes them.

A plugin installed in **VS Code does not cover Claude Code** in the same editor, and the other way
round: each has its own install.

Rules for the configuration:

- **Never promise VS Code's masked dialog** unless you are in a VS Code Local session. In a Copilot
  session, a `.vscode/mcp.json` with `${input:…}` can't work, however often it is restarted: say
  "this is a VS Code Copilot session, which can't ask for the token; it reads
  `~/.copilot/mcp-config.json` and your environment variables", then set up `copilot-cli`.
- **Never create a workspace-root `.mcp.json`**, or any other file, by hand to work around a missing
  prompt. The setup script writes the right file for each client.
- **A workspace-root `.mcp.json` with `leanscope-*` servers, or an empty one**: the setup warns
  about both. Show the user what it found and, once they agree, run
  `node <kit>/scripts/setup-mcp.mjs --clean-root` (`--dry-run` first). It removes only the
  `leanscope-*` servers and inputs, keeps everything else, and **deletes the file if nothing is
  left**. Don't edit it by hand, and never leave an empty config file behind.
- **Never invent variable names**: no shorter aliases, no names without the `LEANSCOPE_` prefix.
  Use exactly the ones under *Secrets* below (from `.env.example`). The script warns about any
  other name.

**Servers listed twice in VS Code, or "Unknown MCP channel" for all three:** either two files
register them (the setup script names both; keep the one for the user's session type), or an old
copy of the kit's VS Code plugin still brings its own `leanscope-*` servers: 0.1.x, or the 0.3.1
build that shipped a root `mcp.json` by mistake. VS Code doesn't update plugins on its own. Tell
the user to update it (README, *GitHub Copilot in VS Code*), then reload the window.

### Secrets

Where a client reads the environment, these are the variables, exactly as `.env.example` names
them. The user puts them in their shell profile themselves; you never see or write the values. A
project `.env` is not read by any MCP client. Give the user the command that opens the file, for
example `code ~/.zshrc` (zsh, the macOS default) or `code ~/.bashrc`. `--check` names the right one.

| Variable                                                                                                               | What                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`                                                                           | their LeanScope personal team-repos access token                  |
| `LEANSCOPE_OPENAI_API_KEY`, `LEANSCOPE_ANTHROPIC_API_KEY`, `LEANSCOPE_MISTRAL_API_KEY`, `LEANSCOPE_ELEVENLABS_API_KEY` | their own LLM keys; at least one completion model to run a choreo |

The token comes from https://app.leanscope.ai/ (avatar, top-right).

### Reload the servers

After a change to the MCP configuration or to the variables, the tools show up only once the client
reloads its servers. Tell the user the step for **their** client, as a command where there is one:

| Client                  | After a config change                                                                                         | After setting or changing a variable                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Claude Code             | start a new session (accept the plugin install); `/mcp` shows the servers                                     | none needed; run `/plugin configure agent-kit@leanscope`, then start a new session          |
| VS Code, Local session  | Command Palette → **MCP: List Servers** → each `leanscope-*` server → **Start** (or **Restart**); enter the token in the masked dialog | — (prompted). A server that fails: **MCP: List Servers** → server → **Show Output**        |
| VS Code, Copilot session | open a new Copilot session                                                                                   | quit VS Code completely (⌘Q), run `code <project folder>` in a new terminal, open a new Copilot session |
| Copilot CLI             | start a new `copilot` session; `/mcp` shows the servers                                                       | open a new terminal, run `copilot`                                                          |
| Codex, Cursor           | restart the client                                                                                            | quit it, start it from a new terminal (`cursor <project folder>` for Cursor)                |

Then check again (step 1). Still no tools → configuration is missing for this session: recheck
step 0. Tools there but failing → authentication or startup: run `--check` again.

## 3. The repository id

Pass the id as `repositoryId` to every `leanscope-graphql` tool:

1. **The user named one** ("repository 2067"): use it.
2. Otherwise take it from `get_credential_permissions` on `leanscope-admin`. A personal team-repos
   access token returns exactly one repository id.

**Never ask the user for it.** If admin rejects the token, the token is the problem, and graphql
can't read any repository with it either: fix the token (step 2). If admin can't be reached for
another reason (channel missing, no network), say so with the cause and carry on with what works.

## 4. Find out what they want

Only now, with an accepted token: ask what the choreo should achieve, for whom, and whether one
exists already. If they have one, find it: with `leanscope-graphql`, list the repository's
scenarios by name (`search_schema` first, then `query_graphql`) and let the user pick. Then hand
over to the matching skill above.

## Verify

Before handing over: you asked which client (step 0); admin accepted the token and gave you the
repository id (or the user named it); `search_schema` returns entries; the user knows the state of
each server you checked (and the cause for any that failed); and they know which choreo (scenario
`_guid`) you are working on. No empty or leftover config file is left behind.
