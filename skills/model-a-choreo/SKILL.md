---
name: model-a-choreo
description: Use when the user wants to create, extend or change a LeanScope choreo — its steps, the personas who speak, the questions it asks (facets), branches, remembered answers (Inventory), theme or model. Writes into the user's LeanScope repository through the `leanscope-graphql` MCP server.
---

# Model a choreo

A choreo is data in the user's LeanScope repository: a **Scenario** with **ScenarioSteps**, the
**Personas** who speak, and **resources** (questions, configuration, theme, workers) attached by
**ResourceRelationships**. You write it with the `leanscope-graphql` MCP server; the hosted agent
server runs it (skill `run-a-choreo`). Pass the repository id as `repositoryId` to every
`leanscope-graphql` tool: the one the user named, otherwise the one `leanscope-quickstart` step 3
found.

Read these before writing anything — they are short and they are the contract:

- `reference/concepts.md` — what each piece means and how a step becomes a human turn, a branch, a loop.
- `reference/data-model.md` — the entities, fields and stable platform guids.
- `reference/write-rules.md` — the rules that keep writes from destroying data. **Mandatory.**
- `reference/minimal-example.md` — the smallest choreo that works, end to end.

## Process

0. **Connected first.** If you can't call `search_schema` (`leanscope-graphql`), stop: don't ask
   about the goal yet. Follow `leanscope-quickstart` to get connected, then come back.
1. **Understand the goal.** What should the conversation achieve, with whom, which persona leads,
   what must the human answer, what happens at the end. Sketch the steps as a short list and confirm
   it with the user before writing.
2. **Read before you write.** `search_schema` → inspect fields → `query_graphql`. Never assume a field
   exists. Check the platform types you need exist in this repository (query them by `_guid`, see
   `data-model.md`). Look for resources the repository already has — a Config, a language model, a
   theme, personas — and reuse them instead of creating new ones.
3. **Choose your own `_guid`s** (UUIDs) for everything you create, and keep them in your notes, so a
   retry updates the same rows instead of duplicating them.
4. **Write in dependency order**, one mutation each, previewing every one first:
   `preview_repository_changes` → read the result → `apply_repository_changes`.
   1. personas, resources (facets, …) and the scenario;
   2. steps and user stories;
   3. resource relationships (kind bindings, attachments, overrides).
5. **Read back** what you wrote. The backend may accept a write it does not keep — only a read proves it.
6. **Run it**: hand over to `run-a-choreo` and step through it once with the user.

## Never

- Send `action: "UPDATE"` — it wipes every field you did not send. Omit `action` (see write rules).
- Send a partial `parameters`, `parameterOverrides`, `successorRefs` or `predecessorRefs` array — a
  supplied array replaces the stored one completely.
- Use `IS` to attach a resource to a step. `IS` declares what a resource *is*.
- Write the English word "loop" into a step's `line` followed by an id — the engine treats that as a
  jump instruction.
- Delete anything the user did not ask you to delete. Deleting is `{ _guid, action: "DELETE" }`,
  relationships first.

## Verify

The scenario, its steps (with both `predecessorRefs` and `successorRefs`), its attachments and every
override read back as written; and one run through `run-a-choreo` reaches the end.
