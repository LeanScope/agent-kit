---
name: run-a-choreo
description: Use when the user wants to run, try, test or debug a LeanScope choreo on the hosted agent server — start a session, answer its questions turn by turn, read the transcript or the server log. Needs the `leanscope-agents` MCP server.
---

# Run & test a choreo

A **choreo** is a scripted conversation between AI personas and a human, authored as data in a
LeanScope repository. The hosted agent server runs it. You drive one session turn by turn through
the `leanscope-agents` MCP server — as the user, on the user's own LLM keys.

## Before you start

1. The `leanscope-agents` MCP server is connected and lists `session_start`. If it is missing, run
   the `leanscope-quickstart` skill first.
2. You know the choreo's `_guid` (the scenario to run). If the user does not, find it with the
   `leanscope-graphql` server: query the repository's scenarios and let the user pick by name.
3. **Never** ask for, accept or pass an API key in chat or in a tool argument. Keys travel from the
   user's environment through the MCP configuration (`X-LeanScope-Key-<vendor>` headers).
   `session_start` reports which vendors' keys arrived (`keysSent`) — names only.

## The loop

```
session_start(choreoScenarioGuid)            → sessionToken, uiUrl
loop:
  session_get_next_step(sessionToken, waitSeconds=20)
    status "working" → call again
    status "asking"  → answer it (below), then session_submit(sessionToken, data)
    status "ended"   → stop; report endReason
```

- Give the user the `uiUrl` right after starting: they can watch the session in a browser, hear
  voices, and see the theme. Your turn-by-turn loop and the browser are the same session.
- **Answering.** `step.question` is what the session said; `step.schema` is the JSON Schema of the
  answer; `step.fieldKeys` are its keys; `step.required` must be present; `step.prefill` holds
  values the session already knows. Send `data` as one JSON object matching the schema — e.g.
  `{ "givenName": "Anna" }`, or `{ "message": "…" }` for a plain-text prompt.
- **Whose answer?** By default ask the user, quoting `step.question`, and send exactly what they
  say. Only invent answers yourself when the user asked you to test the choreo unattended — then
  say which answers you made up.
- Choices are in the schema (`enum` / `oneOf` with `const` + `title`): send the `const`, show the
  user the `title`.

## Debugging

- `session_get_transcript(sessionToken)` — who said what so far.
- `session_get_log(sessionToken, limit)` — the agent server's own log of the session: model calls,
  transitions, errors. Read it when a step behaves unexpectedly before changing the choreo.
- Typical endings: `terminal` (reached the end), `infinite-loop` (the choreo kept looping without
  progress — check its transitions), `choreo-structure-changed` (a step the session needed was
  edited away while it ran).
- `422 api-keys-required` on start: no completion-model key arrived — check the user's environment
  and MCP configuration (see `leanscope-quickstart`).

## Verify

Before you report success: the session reached `ended` with `endReason: terminal`, or you stopped
deliberately; and you can name each question asked and the answer given.
