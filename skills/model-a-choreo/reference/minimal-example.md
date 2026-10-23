# The smallest choreo that works

A host greets the user, asks for their name with a form, thanks them by name, and ends.
`P`, `F`, `C`, `S1`, `S2`, `R1`, `R2` stand for UUIDs you generate.

**Before**: check the Facet type `f20aa3bd-0b1a-4770-89f1-bd3b5bd0fa61` exists in the repository.
Optionally find an existing language model and Config to attach.

## Mutation 1 — persona, facet, scenario

- Persona `P`: `name: "Host"`, `instructions: "Warm, brief, never more than two sentences."`
- Resource (equipment) `F`: `line: "Your name"`, `parameters: []`
- Scenario `C`: `title: "Name check"`, `type: Choreo`, `primaryActorRef: P`

## Mutation 2 — steps

- `S1`: `scenarioRef: C`, `title: "Ask name"`,
  `line: "Greet the user and ask for their name."`, `predecessorRefs: []`, `successorRefs: [S2]`
- `S2`: `scenarioRef: C`, `title: "Goodbye"`,
  `line: "Thank the user by name and say goodbye."`, `predecessorRefs: [S1]`, `successorRefs: []`

## Mutation 3 — relationships

- `R1` — the facet's kind and keywords:
  `ownerRef: F`, `resourceRef: f20aa3bd-0b1a-4770-89f1-bd3b5bd0fa61`, `predicate: IS`,
  `parameterOverrides`:
  - `908c5d0a-9ce1-404e-966e-0098ad54b072` (key) = `fullName`
  - `f30b7288-57d6-48e9-a3d0-fad2e96e0c9a` (type) = `string`
  - `e1f7a3c0-0001-4b10-9c21-fa5e0d7b1001` (title) = `Your name`
  - `c45cb6f1-7a96-4159-b032-358a8dae5032` (minItems) = `1`
  - `65e0e3ca-0312-4e91-ae54-dd4d8eedf018` (maxItems) = `1`
- `R2` — the question asked at `S1`: `ownerRef: S1`, `resourceRef: F` (no predicate, no overrides)

## What happens

`S1` is the entry (no predecessors). The host speaks `S1`'s task, then the form `{ fullName }` waits
for the human. On submit the choreo moves to `S2`, the host says goodbye, and the session ends
(`S2` has no successors).

**Variant — a free-text answer instead of a form**: drop `F`, `R1`, `R2` and add a UserStory
`originScenarioRef: C`, `originScenarioStepRef: S1`, `userNeed: "The user tells their name"`,
with no `actorRef`.

Then run it with `run-a-choreo`: `session_start({ choreoScenarioGuid: C })`.
