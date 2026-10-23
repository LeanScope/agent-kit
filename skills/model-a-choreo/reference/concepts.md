# Choreo concepts

## The pieces

| Piece | Is | Notes |
| --- | --- | --- |
| **Scenario** | the choreo | `title` is its name; `primaryActorRef` names the persona who leads every step. Steps point at it (`scenarioRef`); it does not list them. |
| **ScenarioStep** | one beat of the conversation | `line` is the lead persona's **task** for this beat ("Greet the user and ask for their name") — an instruction, not a verbatim script. |
| **Persona** | someone who speaks | `name`, `instructions`, `quote`, motivations, frustrations, profile. The lead persona comes from the scenario. |
| **UserStory** | a need raised at a step | Who must act (`actorRef`: a persona = an AI participant; empty = the human) and what (`userNeed`). Used for choices, extra speakers and free-text answers. |
| **Resource** | anything attached | A question form (facet), Config, model, theme, worker, Inventory. What it is comes from its `IS` relationship to a platform type. |
| **ResourceRelationship** | an edge between two things | `ownerRef` → `resourceRef`, optional `predicate`, and `parameterOverrides` that configure this one use. |

## Turns

**Every step is an agent turn**: the lead persona acts on the step's `line`. A step becomes a
**human turn** only when it asks something:

- **A question form** — an input facet attached to the step. The human gets a form; on submit the
  choreo moves on without another model call.
- **A free-text answer** — a UserStory on the step with an empty `actorRef` (the human). The human
  gets a text box.

A step that asks nothing moves on by itself after the persona has spoken (unless a Config with
`autoTransition = "false"` holds it until the human presses Continue).

**More speakers**: a UserStory with `actorRef` = another persona makes that persona answer after the
lead, with no human input. Several of them make a panel.

## Order and flow

- **Entry**: the step with an empty `predecessorRefs`.
- **Next**: `successorRefs`. Write `predecessorRefs` on the other side too — both directions, always.
- **End**: a step with no successors.
- **Choice** (the human picks 1 of N): on step C, one UserStory per option (`actorRef` empty,
  `userNeed` = the option's label, `originScenarioStepRef` = C); C has one successor per option, and
  each successor names its option in `triggeringUserStoryRefs`. An option may carry its own form,
  revealed when it is picked.
- **Several successors without a choice**: the engine lets a model pick the most fitting one, guided by
  the successors' `triggeringUserStoryRefs`.
- **Loop back**: put an earlier step into `successorRefs`. For "go back there, then come back here",
  give the need `revisitingScenarioStepRefs`: entering one of those steps returns one step past the
  need's origin.

## Remembering answers — the 🍱 Inventory

Attach an Inventory to the scenario and the choreo can **remember** answers across sessions:

- the Inventory **declares a slot** for each question it should keep (`Inventory → Facet`);
- an answer to a declared question is stored in the Inventory and **pre-fills** that step next time —
  the step is not asked again;
- answers to undeclared questions live only in their session.

To ask again, the user deletes the stored answer in LeanScope. An Inventory in `collect` mode keeps
every session's answer side by side instead of pre-filling.

## Live voice calls

Attach a model of the 🎙 Realtime Model type to a step (or the scenario): that step becomes a live
voice call led by the lead persona. The call's questions are the Inventory's declared slots; it ends
when they are answered. Needs the user's OpenAI key.

## Workers

A worker lets a step call the user's own code (skill `write-a-worker`): attached to a step it runs
when the step is entered; attached to a UserStory it runs every time that need is answered.
