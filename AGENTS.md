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

Three MCP servers: `leanscope-admin` (which repository the token names), `leanscope-graphql`
(read/write the repository) and `leanscope-agents` (run sessions).

Rules that always apply:

- Never ask for, accept, print or write a token or API key. They come from the user's environment
  (`.env.example` lists the exact names; never invent others) through the MCP configuration.
- First ask which client and session the kit is for (quickstart step 0, a single choice; VS Code
  *Local* and *Copilot* sessions read different files) and set up only that one, with the setup
  script. Never add a workspace-root `.mcp.json` for the `leanscope-*` servers, and never leave an
  empty one behind (`--clean-root` tidies it).
- The repository id: the one the user names wins; otherwise ask `get_credential_permissions`.
  Never ask the user for it: if `leanscope-admin` rejects the token, fix the token.
- Diagnose with `scripts/setup-mcp.mjs --check` yourself; hand the user one command or link, not
  a path to go and look at.
- Never send `action: "UPDATE"` to the LeanScope API; omit `action` (see
  `skills/model-a-choreo/reference/write-rules.md`).
- Preview every repository write before applying it, and read it back afterwards.

Changing the kit itself, not using it? Follow `CONTRIBUTING.md`.
