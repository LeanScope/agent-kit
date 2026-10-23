# Your LeanScope worker

`npm install && npm start` — listens on `PORT` (default 3000) at `WORKER_PATH`
(default `/leanscope/worker`). The hosted agent server must reach it: deploy it, or use a tunnel
during development (`cloudflared tunnel --url http://localhost:3000`).

What arrives, per run (`POST`, `Authorization: Bearer <token>` — use it to read your arguments):

```json
{
  "sessionToken": "…",
  "config": {
    "context": {
      "activityGuid": "…", "repositoryId": 1234,
      "resourceRelationshipGuids": ["<IS binding>", "…", "<the attachment — last>"],
      "choreoStepGuid": "…", "insertAfterStepGuid": "…",
      "input": { "…": "the answer that fired a need, if any" }
    },
    "endpoints": { "gqlApiUrl": "…", "activityApiUrl": "…", "choreoStepsUrl": "…", "agentApiUrl": "…" }
  }
}
```

`leanscope.mjs` turns that into your arguments (`readArguments`), reports progress
(`reportActivity`) and can write the next step (`insertStep`). Answer `200` when the work is done.
