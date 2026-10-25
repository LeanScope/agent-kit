# LeanScope Agent Kit

Model, run and extend **LeanScope choreos** — scripted conversations between AI personas and humans:
interviews, onboardings, panel discussions — straight from your coding agent.

Works with **Claude Code**, **GitHub Copilot** (VS Code *Agent* sessions and Copilot CLI), **OpenAI
Codex** and **Cursor**.

Out of the box, batteries not included: everything runs in **your** LeanScope repository, with
**your** personal team repos access token and **your own LLM keys**. The hosted agent server holds
your keys in memory for a session and never stores them.

## What your agent can do with it

| Skill | Your agent… |
| --- | --- |
| `leanscope-quickstart` | checks the connection, explains the pieces, picks the right skill |
| `model-a-choreo` | creates or changes a choreo: steps, personas, questions, branches, remembered answers |
| `run-a-choreo` | starts a session, lets you answer it turn by turn, reads the transcript and the log |
| `write-a-worker` | scaffolds an endpoint in your project that a step calls while the session runs |

## 1. The batteries

| Secret | |
| --- | --- |
| LeanScope personal team repos access token | required; it names the repository your choreos live in |
| OpenAI key | for most choreos, and for live voice calls |
| Anthropic, Mistral, ElevenLabs keys | optional, as your choreos need them |

At least one completion-model key is needed to run a choreo. Never paste any of them into a chat.

**Claude Code and VS Code ask for them** and store them themselves (OS credential store, or
encrypted by VS Code). Nothing to set up beforehand.

**Copilot CLI, Codex and Cursor read them from environment variables.** Add them to your shell
profile (`~/.zshrc` or `~/.bashrc`; `.env.example` lists the names), then restart the client from a
new terminal. A project `.env` doesn't work: no MCP client reads it.

```sh
export LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN=…
export LEANSCOPE_OPENAI_API_KEY=…
# optional: LEANSCOPE_ANTHROPIC_API_KEY, LEANSCOPE_MISTRAL_API_KEY, LEANSCOPE_ELEVENLABS_API_KEY
```

## 2. Install

**The short way:** install the plugin for your client (below), then ask your agent *"Set up
LeanScope in this project."* It connects the MCP servers for you.

To connect the MCP servers by hand, run the setup script in your project; it needs Node.js, no
clone:

```sh
npx -y github:leanscope/agent-kit --clients <client>
```

It writes references only, never a secret, and keeps every other server in the file. From a clone,
`node <path-to-agent-kit>/scripts/setup-mcp.mjs` takes the same options.

### Claude Code

```
/plugin marketplace add leanscope/agent-kit
/plugin install agent-kit@leanscope
```

The plugin brings the skills and all three MCP servers, and asks for the token and keys while it
installs. To change them later: `/plugin configure agent-kit@leanscope`. (The shell command
`claude plugin install` doesn't ask; run `/plugin configure` afterwards.)

This also applies to the **Claude Code extension in VS Code**: a plugin installed for GitHub
Copilot in VS Code does not reach Claude Code. Each needs its own install.

Your agent can't run `/plugin`, but it can enable the plugin for the project:
`npx -y github:leanscope/agent-kit --clients claude-code` adds this to `.claude/settings.json`, and
Claude Code offers the install when the next session starts:

```json
{
  "extraKnownMarketplaces": {
    "leanscope": { "source": { "source": "github", "repo": "leanscope/agent-kit" } }
  },
  "enabledPlugins": { "agent-kit@leanscope": true }
}
```

### GitHub Copilot in VS Code

Copilot chat in VS Code has two session types, and each reads its own configuration:

- **Agent** (local): reads the project's `.vscode/mcp.json`.
- **Copilot CLI**: reads `~/.copilot/mcp-config.json` and never `.vscode/mcp.json`. Set it up as
  in [Copilot CLI](#github-copilot-cli) below.

New chats may open as either type, so set up both if you're unsure.

For *Agent* sessions:

1. Install the plugin: Command Palette → **Chat: Install Plugin From Source** →
   `https://github.com/leanscope/agent-kit` (or add `"chat.plugins.marketplaces": ["leanscope/agent-kit"]`
   to your settings). VS Code also discovers the skills when this repository is cloned into
   `.agents/skills`.
2. Ask your agent *"Set up LeanScope in this project."* It writes `.vscode/mcp.json` for you (or run
   `npx -y github:leanscope/agent-kit --clients vscode` yourself). A plugin can't ask for secrets
   (the Agent Plugins format has no inputs), which is why the servers live in your project. Then
   Command Palette → **MCP: List Servers**, start the `leanscope-*` servers: VS Code asks for your
   token and OpenAI key in a masked dialog and stores them encrypted. For other keys add
   `--keys openai,anthropic,mistral,elevenlabs` (each key is one dialog); to use environment
   variables instead, add `--secrets env`.

**Updating the plugin.** VS Code keeps the version you installed and doesn't update it on its own.
Pull the newest one with
`git -C ~/.vscode/agent-plugins/github.com/LeanScope/agent-kit pull`, or uninstall the plugin and
install it again, then reload the window. If the `leanscope-*` servers show up twice, or every one
of them reports "Unknown MCP channel", you still have a 0.1.x plugin that brings its own servers:
update it.

### GitHub Copilot CLI

1. Optional, for the skills: `copilot plugin install leanscope/agent-kit`.
2. `npx -y github:leanscope/agent-kit --clients copilot-cli`
   → adds the servers to `~/.copilot/mcp-config.json` (or `$COPILOT_HOME`), for every project.
   They reference your environment variables (`${LEANSCOPE_…}`), so set them first (see
   [the batteries](#1-the-batteries)).

### OpenAI Codex

1. `codex plugin marketplace add leanscope/agent-kit`, then install **agent-kit** from `/plugins`
   (CLI). In the IDE extension, plugins are not available yet: clone this repository and copy
   `skills/*` into your project's `.agents/skills/`.
2. `npx -y github:leanscope/agent-kit --clients codex`
   → writes the `[mcp_servers.leanscope-*]` block into `.codex/config.toml`, which Codex reads only
   in trusted projects. Token and keys come from your environment variables
   (`bearer_token_env_var`, `env_http_headers`).

### Cursor

1. Install the plugin from the marketplace, or copy this repository to
   `~/.cursor/plugins/local/agent-kit`.
2. `npx -y github:leanscope/agent-kit --clients cursor`
   → writes `.cursor/mcp.json`, referencing your environment variables (`${env:…}`).

## 3. First steps

Ask your agent: *"Set up LeanScope in this project."* — the quickstart skill checks each server,
connects the missing ones and tells you what it changed. Then, for example:

- *"Show me the choreos in my repository."*
- *"Run the interview choreo and let me answer the questions."*
- *"Add a step that asks for the participant's role, and remember the answer for next time."*
- *"When the guide is uploaded, call my endpoint to summarise it."*

## How it fits together

```
your coding agent ──MCP──▶ leanscope-admin    ──▶ which repository your token names
                  ├─MCP──▶ leanscope-graphql  ──▶ your LeanScope repository   (model)
                  └─MCP──▶ leanscope-agents   ──▶ hosted agent server        (run, your keys)
                                                        │
                                                        └──HTTP──▶ your worker  (optional)
```

The agent server's REST API is documented at `https://dev.api.agents.leanscope.ai/api/v1/docs`.

## Example

`examples/interview-from-guide/` — an interview led by an AI persona over a live voice call, whose
questions come from an uploaded guide and whose answers are kept in the choreo's Inventory.

## Security

- No secret ever lives in this repository or in the files the setup script writes.
- Keys reach the agent server as request headers that your client fills in, from its credential
  store or your environment; they never pass through your agent's context.
- CI scans every push for secrets (`.github/workflows/secret-scan.yml`).
