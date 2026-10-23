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

Everything runs **as the user**: their LeanScope repository, their access token, their own LLM keys.
Nothing is billed to anyone else, and the engine never stores their keys.

## 1. Check the connection

Look at your available tools.

- `leanscope-admin` is connected when you can call `get_credential_permissions`.
- `leanscope-graphql` is connected when you can call `search_schema`.
- `leanscope-agents` is connected when you can call `session_start`.

If all three are there, go to step 3.

## 2. Fix what is missing — the "batteries"

The kit needs these in the user's environment (`.env.example` lists them). **Never ask the user to
paste a token or key into the chat**, and never write one into a file. Tell them where to set it.

| Variable                                                                                                    | What                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN`                                                                                    | their LeanScope repository access token                                      |
| `LEANSCOPE_OPENAI_API_KEY`, `LEANSCOPE_ANTHROPIC_API_KEY`, `LEANSCOPE_MISTRAL_API_KEY`, `LEANSCOPE_ELEVENLABS_API_KEY` | their own LLM keys; at least one completion model to run a choreo |

Then the MCP configuration, per agent:

- **Claude Code** — nothing to write; the plugin ships it. Variables must be set in the shell that
  starts Claude Code; restart it after changing them.
- **GitHub Copilot (VS Code), Cursor, Codex** — run, from the kit's folder:
  `node scripts/setup-mcp.mjs --project <their project>` (add `--vendors vscode` etc. to limit it).
  It writes `.vscode/mcp.json`, `.cursor/mcp.json` and `.codex/config.toml`, each only
  *referencing* the variables. VS Code and Cursor read variables from the environment the editor was
  started from — on macOS, start it from a terminal (`code .`) if a variable seems missing.

## 3. Get the repository id

Call `get_credential_permissions` on leanscope-admin once. An access token returns one repository
id; pass it as `repositoryId` to every leanscope-graphql tool. Never ask the user for it.

## 4. Find out what they want

Ask what the choreo should achieve, for whom, and whether one exists already. If they have one, find
it: with `leanscope-graphql`, list the repository's scenarios by name (`search_schema` first, then
`query_graphql`) and let the user pick. Then hand over to the matching skill above.

## Verify

Before handing over, all three servers answer: `get_credential_permissions` returns the repository
id, `search_schema` returns entries, and the user knows which choreo (scenario `_guid`) you are
working on.
