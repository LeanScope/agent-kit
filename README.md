# LeanScope Agent Kit

Model, run and extend **LeanScope choreos** — scripted conversations between AI personas and humans:
interviews, onboardings, panel discussions — straight from your coding agent.

Works with **Claude Code**, **GitHub Copilot** (VS Code), **OpenAI Codex** and **Cursor**.

Out of the box, batteries not included: everything runs in **your** LeanScope repository, with
**your** access token and **your own LLM keys**. The hosted agent server holds your keys in memory
for a session and never stores them.

## What your agent can do with it

| Skill | Your agent… |
| --- | --- |
| `leanscope-quickstart` | checks the connection, explains the pieces, picks the right skill |
| `model-a-choreo` | creates or changes a choreo: steps, personas, questions, branches, remembered answers |
| `run-a-choreo` | starts a session, lets you answer it turn by turn, reads the transcript and the log |
| `write-a-worker` | scaffolds an endpoint in your project that a step calls while the session runs |

## 1. The batteries

Set these in your environment — shell profile, direnv or a secrets manager (see `.env.example`).
Never paste them into a chat.

| Variable | |
| --- | --- |
| `LEANSCOPE_ACCESS_TOKEN` | your LeanScope repository access token |
| `LEANSCOPE_OPENAI_API_KEY` | your OpenAI key (also needed for live voice calls) |
| `LEANSCOPE_ANTHROPIC_API_KEY`, `LEANSCOPE_MISTRAL_API_KEY`, `LEANSCOPE_ELEVENLABS_API_KEY` | optional, as your choreos need them |

At least one completion-model key is needed to run a choreo.

## 2. Install

### Claude Code

```
/plugin marketplace add leanscope/agent-kit
/plugin install agent-kit@leanscope
```

The plugin brings all three MCP servers. Start Claude Code from a shell where the variables are set.

### GitHub Copilot in VS Code

1. Install the plugin: Command Palette → **Chat: Install Plugin From Source** →
   `https://github.com/leanscope/agent-kit` (or add `"chat.plugins.marketplaces": ["leanscope/agent-kit"]`
   to your settings). VS Code also discovers the skills when this repository is cloned into
   `.agents/skills`.
2. Connect the MCP servers in your project:
   `node <path-to-agent-kit>/scripts/setup-mcp.mjs --project . --vendors vscode`
   → writes `.vscode/mcp.json`, referencing your variables (`${env:…}`), no secrets.
3. Start VS Code from a terminal (`code .`) so it sees the variables.

### OpenAI Codex

1. `codex plugin marketplace add leanscope/agent-kit`, then install **agent-kit** from `/plugins`
   (CLI). In the IDE extension, plugins are not available yet: clone this repository and copy
   `skills/*` into your project's `.agents/skills/`.
2. `node <path-to-agent-kit>/scripts/setup-mcp.mjs --project . --vendors codex`
   → writes the `[mcp_servers.leanscope-*]` block into `.codex/config.toml` (trusted projects only).
   Tokens and keys are read from your environment (`bearer_token_env_var`, `env_http_headers`).

### Cursor

1. Install the plugin from the marketplace, or copy this repository to
   `~/.cursor/plugins/local/agent-kit`.
2. `node <path-to-agent-kit>/scripts/setup-mcp.mjs --project . --vendors cursor`
   → writes `.cursor/mcp.json`, referencing your variables (`${env:…}`).

## 3. First steps

Ask your agent: *"Set up LeanScope in this project."* — the quickstart skill checks the servers and
tells you what is missing. Then, for example:

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

The agent server's REST API is documented at `https://api.agents.leanscope.ai/api/v1/docs`.

## Example

`examples/interview-from-guide/` — an interview led by an AI persona over a live voice call, whose
questions come from an uploaded guide and whose answers are kept in the choreo's Inventory.

## Security

- No secret ever lives in this repository or in the files the setup script writes.
- Keys reach the agent server as request headers set from your environment; they never pass through
  your agent's context.
- CI scans every push for secrets (`.github/workflows/secret-scan.yml`).
