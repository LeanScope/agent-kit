# Data model

All names are fields of the LeanScope UXM GraphQL API. Inspect them with `search_schema` before use.

## Platform types — stable guids

A resource's **kind** comes from an `IS` relationship to a platform type
(`resource --IS--> type`). These type guids are the same in every LeanScope repository — but a type
only works in a repository that contains it. **Check first**:

```graphql
query { uxmData(repositoryId: <id>, guidFilter: ["f20aa3bd-0b1a-4770-89f1-bd3b5bd0fa61"]) {
  equipments { _guid line parameters { _guid key value } } } }
```

If a type you need is missing, stop and tell the user: their repository needs it distributed.

| Kind | Type guid | Use |
| --- | --- | --- |
| 🧩 Facet (a question / an output) | `f20aa3bd-0b1a-4770-89f1-bd3b5bd0fa61` | forms and outputs |
| Composite facet (a form of several) | `bf328b6b-9a11-4a7e-a38f-1ed97f4542f4` | children: `composite --HAS--> facet`, ordered by `listIndex` |
| 🍱 Inventory | `4b9b0347-8cfa-4cb2-a185-7516ab10f566` | remembered answers |
| ⚙️ Config | `8bf480b7-3eb1-490f-82e9-e41d8ceaf08d` | start / transition behaviour |
| 🦾 Worker | `dbf0ecbb-1e96-4644-9d90-a6c5930b7e5b` | call your code |
| ❓ Query | `563e5a6f-4d97-4108-a4b0-3bdb1afd0fe5` | options for a picker |
| 🎨 Theme | `326174a1-fb9e-4241-8d4a-f9bac7710279` | look of a session |
| 💬 Language Model | `1f484f64-5692-4af3-8b82-49ed91dd0036` | the model personas think with |
| 🎙 Realtime Model | `87551594-f7f5-4e55-8ded-fc4a0deedacb` | live voice calls |
| 📣 Speech Synthesis Model | `a2309ac1-0e06-493f-bb52-8d9c37b19407` | voices |

Prefer **attaching existing resources** (a language model, a Config, a theme the repository already
has) over creating new ones.

## Scenario

| Field | Value |
| --- | --- |
| `_guid` | your UUID |
| `title` | the choreo's name |
| `type` | `Choreo` |
| `primaryActorRef` | the lead persona's `_guid` — speaks every step |

Attachments hang off the scenario as relationships with `ownerRef` = the scenario.

## ScenarioStep

| Field | Value |
| --- | --- |
| `_guid` | your UUID |
| `scenarioRef` | the scenario's `_guid` |
| `title` | a short label |
| `line` | the lead persona's task for this beat |
| `predecessorRefs` | steps that lead here — empty on the entry step |
| `successorRefs` | steps that follow — empty on the last step |
| `triggeringUserStoryRefs` | on a successor of a choice: the option (UserStory) that leads here; else empty |

Leave `actorSymbolRef` empty: the scenario's lead persona speaks. Do not write `actions`,
`questions`, `visuals` or `activeSuccessorRef` — sessions write those.

## Persona

`_guid`, `name` (required), `instructions`, `quote`, `motivations: [{description}]`,
`frustrations: [{description}]`, `profile`, `sociodemographicInfo: [{key, description}]`.

## UserStory (a need)

| Field | Value |
| --- | --- |
| `_guid` | your UUID |
| `originScenarioRef` / `originScenarioStepRef` | the scenario / step where it is raised |
| `actorRef` | a persona `_guid` (an AI participant) — or **omit it** for the human |
| `userNeed` | what is needed; for a choice, the option's label |
| `revisitingScenarioStepRefs` | steps that, once entered, return to one past this need's origin |

## Facets — questions and outputs

A facet is a resource (`equipments`, `parameters: []`) plus its kind binding
`facet --IS--> f20aa3bd-…` whose `parameterOverrides` hold its keywords. Every keyword is addressed by
the **parameter guid** the Facet type declares; values are strings.

| Keyword | Parameter guid | Meaning |
| --- | --- | --- |
| `key` | `908c5d0a-9ce1-404e-966e-0098ad54b072` | the field's name in the answer |
| `type` | `f30b7288-57d6-48e9-a3d0-fad2e96e0c9a` | `string`, `number`, `integer`, `boolean` |
| `title` | `e1f7a3c0-0001-4b10-9c21-fa5e0d7b1001` | label |
| `description` | `e1f7a3c0-0002-4b10-9c21-fa5e0d7b1002` | help text / the question |
| `required` | `5428e579-456c-411f-a94f-43c407483977` | `"true"` |
| `readOnly` | `4185537d-ccbf-4b0e-9a61-d5e373c191ac` | `"true"` = an OUTPUT (shown, not asked) |
| `default` | `3fe976a9-c61b-4f8e-9848-25e64ec07698` | starting value; for an output, the value shown |
| `minItems` | `c45cb6f1-7a96-4159-b032-358a8dae5032` | `maxItems = "1"` → one value; more → a list |
| `maxItems` | `65e0e3ca-0312-4e91-ae54-dd4d8eedf018` | |
| `enum` | `e1f7a3c0-0007-4b10-9c21-fa5e0d7b1007` | fixed options: a JSON array, e.g. `["yes","no"]` |
| `format` | `e1f7a3c0-0003-4b10-9c21-fa5e0d7b1003` | `email`, `uri`, `textarea`, `markdown`, `data-url` (upload), `password` |
| `contentMediaType` | `e1f7a3c0-0004-4b10-9c21-fa5e0d7b1004` | with `data-url`: e.g. `image/*`, `text/markdown` |
| `minLength` / `maxLength` | `b9f0537d-fc70-4180-9c38-7a8046635789` / `793bb075-66b8-47c5-adc3-2569398c0688` | |
| `minimum` / `maximum` | `e1f7a3c0-0008-4b10-9c21-fa5e0d7b1008` / `e1f7a3c0-0009-4b10-9c21-fa5e0d7b1009` | |
| `pattern` | `e1f7a3c0-0006-4b10-9c21-fa5e0d7b1006` | regular expression |

**Attach** a facet with a relationship `ownerRef` = the step (or a UserStory for a per-need form, or
the scenario for questions asked before the first step), `resourceRef` = the facet, no predicate.
Overrides on that attaching edge vary the facet for this use only (e.g. a different `key`).

**Options with labels and portraits** come from a ❓Query (`facet --REFERENCES--> query`): advanced —
read the repository's existing query resources and copy their pattern.

## Inventory

```
Scenario  --REFERENCES--> Inventory
Inventory --IS-->         4b9b0347-8cfa-4cb2-a185-7516ab10f566
Inventory --REFERENCES--> Facet          one per question to remember (a "declared slot")
```

Only declared questions are kept across sessions. Mode: override `slotFillingMode`
(`aaf05ea1-f768-46d8-b54e-9a466ededc0b`) on the Inventory's `IS` binding — `overwrite` (default: keep
the latest, pre-fill) or `collect` (keep every session's answer, never pre-fill). Stored answers are
written by sessions; do not hand-write them unless the user wants a pre-filled value.

## Config

Attach an existing Config (or create `config --IS--> 8bf480b7-…`) to the scenario — or to one step to
change only that step — and override, as strings `"true"` / `"false"`:

| Parameter | Guid | Default |
| --- | --- | --- |
| `autoStart` | `0927c644-bdf7-4c79-b7ae-1a362fdbc100` | decided by whoever starts the session |
| `autoTransition` | `9b982c82-8edc-44c1-a6f2-0dc4b8c4262f` | `true`; `false` waits for Continue at every step |
| `sendInnerState` | `0a12d823-908c-461e-b7ab-90d9ff2e0031` | `true` |
| `keepSession` | `2788f44a-70df-4414-afc8-b10514e1f2ce` | `false` |

## Models, voice, theme

Attach existing resources to the scenario (no predicate): a 💬 Language Model (the first one is used),
a 🎨 Theme (overrides on the edge change single theme variables), a 🎙 Realtime Model on a step for a
live call (override `maxCallMinutes` `3c20a820-c7ee-4a8e-a39a-005e0dfbaca6`, default 30). A persona's
voice: relationship `persona → speech synthesis model` (or a voice resource).

## Worker

`worker --IS--> dbf0ecbb-…`, overrides on that `IS` edge:

| Parameter | Guid | Value |
| --- | --- | --- |
| `workersDispatcherUrl` | `90c5e634-f36a-4b29-8676-a9ecd8db4a83` | your worker's public URL |
| `waitForCompletion` | `8e55b536-2d9f-467c-844a-99e73e3ca8dd` | `"false"` = do not wait for the response |
| `requiresChoreoCopy` | `eed8c7a6-1136-40c0-bd81-35b42734e43f` | `"true"` if the worker inserts steps |

The worker resource's own `parameters` (each with a stable `_guid`) declare its arguments: `key` =
argument name, `value` = a description. Attach it to a step or a UserStory; the arguments are
overrides on that attaching edge, addressed by those parameter guids. See skill `write-a-worker`.
