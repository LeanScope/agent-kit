# Choreo concepts

## The pieces

| Piece | Is | Notes |
| --- | --- | --- |
| **Scenario** | the choreo | `title` is its name; `primaryActorRef` names the persona who leads every step. Steps point at it (`scenarioRef`); it does not list them. |
| **ScenarioStep** | one beat of the conversation | `line` is the lead persona's **task** for this beat ("Greet the user and ask for their name") — an instruction, not a verbatim script. |
| **Persona** | someone who speaks | `name`, `instructions`, `quote`, motivations, frustrations, profile. The lead persona comes from the scenario. |
| **UserStory** | a need raised at a step | Who must act (`actorRef`: a persona = an AI participant; empty = the human) and what they need (`userNeed`). Used for answers, choices, extra speakers and loops. |
| **Resource** | anything attached | A question form (facet), Config, model, theme, worker, Inventory. What it is comes from its `IS` relationship to a platform type. |
| **ResourceRelationship** | an edge between two things | `ownerRef` → `resourceRef`, optional `predicate`, and `parameterOverrides` that configure this one use. |

## Turns

**Every step is an agent turn**: the lead persona acts on the step's `line`. A step becomes a
**human turn** only when it asks something:

- **A question form** — an input facet attached to the step. The human gets a form; on submit the
  choreo moves on without another model call.
- **A free-text answer** — a **human need** on the step: a UserStory with an empty `actorRef`, with
  a 💬 Message facet attached to the need (`need → facet`, no predicate; keywords `key = message`,
  `type = string`, see `data-model.md`). The human gets that text box. Always attach the facet: it is
  what the need asks, and a loop asks it again on every round (see *Loops*).

**Phrase every `userNeed` as the need** of whoever must act — "Die Person möchte sagen, worüber sie
sprechen möchte", "The user wants to know what the repository contains" — never as an instruction
("Ask for …") or a bare label ("Antworten"). The session phrases questions and option labels from it.

A step that asks nothing moves on by itself after the persona has spoken (unless a Config with
`autoTransition = "false"` holds it until the human presses Continue).

**More speakers**: a UserStory with `actorRef` = another persona makes that persona answer after the
lead, with no human input. Several of them make a panel.

## Order and flow

- **Entry**: the step with an empty `predecessorRefs`.
- **Next**: `successorRefs`. Write `predecessorRefs` on the other side too — both directions, always.
- **End**: a step with no successors.
- **Choice** (the human picks 1 of N, going **forward**): on step C, one human need per option
  (`originScenarioStepRef` = C, `userNeed` phrased as that need); C has one successor per option, and
  each successor names its option in `triggeringUserStoryRefs`. An option may carry its own form,
  revealed when it is picked.
- **Several successors without a choice**: the engine lets a model pick the most fitting one, guided by
  the successors' `triggeringUserStoryRefs`.
- `triggeringUserStoryRefs` is for **forward branches only**. Never use it, or a `successorRefs` entry
  that points back to an earlier step, to build a loop.

## Loops — authored on the need

A loop is declared by the **need**, with `revisitingScenarioStepRefs`:

- Need `N` sits on its origin step `O` (a human need with its facet, as above), and
  `N.revisitingScenarioStepRefs = [R]`.
- When the session reaches `R`, the persona does `R`'s task, then **asks `N` again, with `N`'s own
  facet**. On submit the session continues at **the step after `O`** (`O.successorRefs[0]`) — never
  at `O` itself, which would ask the same thing twice.
- The return **replaces** `R`'s own successors and choices. `R` needs no `successorRefs`; a forward
  branch on `R` is ignored. `O` must have a successor, and `N` must not originate at `R` itself (`O` ≠ `R`).
- Every round takes a human answer, so the loop can run without limit — it ends when the user closes
  the session. An exit option inside the loop is not covered here: agree it with the user and prove
  it with `run-a-choreo` before relying on it.

**A chat that loops** (the most common shape) needs two steps:

```
O  "Stelle dich vor und frage, worüber die Person sprechen möchte."
   N: "Die Person möchte sagen, worüber sie sprechen möchte"   + Message facet
   │  N.revisitingScenarioStepRefs = [R]
   ▼
R  "Gehe auf die Nachricht der Person ein und stelle eine Rückfrage."   (no successors)
   └─► after the answer to N: back to R (the step after O) — every round
```

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
