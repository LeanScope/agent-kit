---
name: write-a-worker
description: Use when a LeanScope choreo step should call the user's own code — fetch data, call an API, generate a document, write the next step — while the session runs. Scaffolds an Express worker into the user's project, makes it reachable, and attaches it to a step via `leanscope-graphql`.
---

# Write a worker

A **worker** is the user's own HTTP endpoint. When a step it is attached to is entered (or a need it
is attached to is answered), the hosted agent server POSTs to it, waits for the answer by default,
and then the choreo continues. The session shows the worker's progress while it runs.

## Before you start

- **Is there already a worker for this?** Ask the user. A worker LeanScope hosts is just attached; no
  code needed (skip to step 4).
- **Reachability.** The *hosted* agent server calls the worker — `localhost` is not reachable. During
  development use a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`), for real use a
  deployment with a public HTTPS URL. Say this to the user up front.

## 1. Scaffold into the user's project

Copy `template/` from this skill into a folder of the user's project (e.g. `leanscope-worker/`):
`server.mjs` (the endpoint), `leanscope.mjs` (the contract helpers), `package.json`. Then
`npm install` there. Do not create a separate repository for it.

## 2. Implement the work

In `server.mjs`, between the markers:

- `await readArguments(body, bearer)` — the worker's arguments as configured on the attachment
  (key → value).
- `body.config.context.input` — the answer that fired it, when attached to a need.
- `reportActivity(body, { … })` — progress the person sees: `{ summary, phase: 'working' }`, then
  `{ progress: 0..1, text }` per item, finally `{ phase: 'succeeded', summary: '<past tense>' }`.
- `insertStep(body, line)` — write the next step into the running choreo (needs `requiresChoreoCopy`).
- Answer `200` when done. A non-2xx answer shows on the session as "<worker> failed: <reason>".
  Work longer than a request should stay open? Set `waitForCompletion` to `"false"` (step 4), answer
  at once, and finish with `phase: 'succeeded'` or `'failed'`.

Keep the path hard to guess (`WORKER_PATH`): anyone who knows the URL can call it.

## 3. Run and expose it

`npm start`, then the tunnel or deployment. Note the public URL, e.g.
`https://<tunnel>.trycloudflare.com/leanscope/worker`.

## 4. Register and attach it (`leanscope-graphql`, read `model-a-choreo` write rules first)

1. A worker resource `W` (equipment) whose `parameters` declare its arguments — each
   `{ _guid: <new UUID>, key: "<argument>", value: "<what it means>" }`.
2. Its kind binding `W --IS--> dbf0ecbb-1e96-4644-9d90-a6c5930b7e5b` with `parameterOverrides`:
   `90c5e634-f36a-4b29-8676-a9ecd8db4a83` (workersDispatcherUrl) = the public URL; optionally
   `8e55b536-2d9f-467c-844a-99e73e3ca8dd` (waitForCompletion) = `"false"`, and
   `eed8c7a6-1136-40c0-bd81-35b42734e43f` (requiresChoreoCopy) = `"true"` if it inserts steps.
3. Attach it: relationship `ownerRef` = the step (runs on entry) or a UserStory (runs on each
   answer), `resourceRef: W`, no predicate, `parameterOverrides` = the argument values addressed by
   the `_guid`s from (1).

## Verify

Run the choreo (`run-a-choreo`) to the step: the worker's log shows the call, the session shows its
progress and summary, and the choreo continues. `session_get_log` shows the dispatch if it does not.
