# LeanScope Agent Kit — instructions for coding agents

This kit lets you model, run and extend **LeanScope choreos** — scripted conversations between AI
personas and a human — for the user, in their own LeanScope repository, on their own LLM keys.

Skills live in `skills/` (one `SKILL.md` each). Start with **`leanscope-quickstart`** whenever the
user mentions LeanScope, choreos or this kit, or when a `leanscope-*` MCP tool is missing.

| Skill | When |
| --- | --- |
| `skills/leanscope-quickstart` | first contact; connection problems |
| `skills/model-a-choreo` | create or change a choreo |
| `skills/run-a-choreo` | run, test or debug a choreo |
| `skills/write-a-worker` | let a step call the user's code |

Two MCP servers: `leanscope-graphql` (read/write the repository) and `leanscope-agents` (run sessions).

Rules that always apply:

- Never ask for, accept, print or write a token or API key. They come from the user's environment
  (`.env.example` lists the names) through the MCP configuration.
- Never send `action: "UPDATE"` to the LeanScope API; omit `action` (see
  `skills/model-a-choreo/reference/write-rules.md`).
- Preview every repository write before applying it, and read it back afterwards.
