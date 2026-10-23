# Write rules — mandatory

The LeanScope API will let you destroy data. These rules keep it from happening.

1. **Omit `action` on every create and update.** With a `_guid`, the backend creates the row or
   merges into it field by field; fields you do not send stay as they are.
   **Never send `action: "UPDATE"`**: it replaces the whole row, and every field you did not send —
   including ones you cannot read back — is set to null.
2. **A supplied array replaces the stored one completely**: `parameters`, `parameterOverrides`,
   `successorRefs`, `predecessorRefs`, `triggeringUserStoryRefs`. Read the current array, change it,
   send it whole. Leaving an entry out deletes it.
3. **Keep parameter `_guid`s.** When you re-send a `parameters` array, send every parameter's existing
   `_guid`. Overrides address parameters by `_guid`; a parameter re-written without its guid silently
   unhooks every override pointing at it. Reads sometimes return `_guid: null` — then stop and ask.
4. **An empty string is a value.** To leave a field alone, omit it; `""` overwrites it.
5. **Choose `_guid`s yourself** (UUIDs) and reuse them on a retry — that makes writes repeatable.
6. **`parameterRef` is the target parameter's `_guid`** (usually a platform type's guid from
   `data-model.md`) — not its key.
7. **Write in dependency order**, one mutation each: personas, resources and scenario → steps and
   user stories → relationships. **Preview each** (`preview_repository_changes`) before applying it.
8. **Link steps both ways**: `successorRefs` on the earlier step AND `predecessorRefs` on the later.
9. **Predicates**: `IS` declares what a resource is (kind) — write it explicitly. `HAS` is custody /
   composition. `REFERENCES` is a pointer (inheritance, slot, options). A plain attachment needs
   none. Never attach with `IS`.
10. **Delete** only on request: `{ _guid, action: "DELETE" }` — relationships first, then resources,
    then steps and user stories, then the scenario. Nothing cascades.
11. **Read back after writing.** A write the backend accepted is not proof it was stored.
