// Helpers for a LeanScope worker — the contract in three functions.
//
// The agent server POSTs one body per run (see README in this folder):
//   { sessionToken, config: { context: { activityGuid, repositoryId, resourceRelationshipGuids,
//     choreoStepGuid, insertAfterStepGuid, input, customId }, endpoints: { gqlApiUrl,
//     activityApiUrl, choreoStepsUrl, agentApiUrl, … } } }
// with `Authorization: Bearer <token>` — the token you use to READ your arguments back.

/**
 * Your worker's arguments: the parameter overrides on its relationships, folded in order (later
 * wins), keyed by the parameter's KEY.
 *
 * `resourceRelationshipGuids` lists the worker's IS binding(s) to the Worker type first and the
 * relationship that ATTACHED it (to a step or a need) last. An override addresses a parameter by
 * its `_guid`; the keys come from the parameters declared on the Worker type and on your worker
 * resource.
 */
export async function readArguments(body, bearer) {
  const { context, endpoints } = body.config;
  const wanted = new Set(context.resourceRelationshipGuids);
  // Reads the repository's relationships and resources once. Fine for a worker; cache it if your
  // repository is large.
  const data = await graphql(
    endpoints.gqlApiUrl,
    bearer,
    `query WorkerArguments($repositoryId: Int!) {
       uxmData(repositoryId: $repositoryId) {
         resourceRelationships { _guid resourceRef parameterOverrides { parameterRef value } }
         equipments { _guid parameters { _guid key value } }
       }
     }`,
    { repositoryId: context.repositoryId },
  );
  const relationships = data.uxmData.resourceRelationships.filter((r) =>
    wanted.has(r._guid),
  );
  // Keep the order the agent server sent: that order IS the precedence.
  relationships.sort(
    (a, b) =>
      context.resourceRelationshipGuids.indexOf(a._guid) -
      context.resourceRelationshipGuids.indexOf(b._guid),
  );

  const keyOf = new Map();
  for (const resource of data.uxmData.equipments) {
    if (!relationships.some((r) => r.resourceRef === resource._guid)) continue;
    for (const p of resource.parameters ?? []) {
      if (p._guid && p.key) keyOf.set(p._guid, p.key);
    }
  }

  const args = {};
  for (const relationship of relationships) {
    for (const o of relationship.parameterOverrides ?? []) {
      args[keyOf.get(o.parameterRef) ?? o.parameterRef] = o.value;
    }
  }
  return args;
}

/**
 * Tell the person what you are doing — shown on the session's step while you work.
 * PATCH merges: send `{ summary, phase: 'working' }` first, then `{ progress: 0..1, text }` per
 * item (one at a time — concurrent requests arrive out of order), and finally
 * `{ phase: 'succeeded' | 'failed', summary: '<what you did, past tense>' }`.
 * Never let a progress report stop the real work: failures here are swallowed.
 */
export async function reportActivity(body, patch) {
  const url = body.config.endpoints.activityApiUrl;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch (error) {
    console.warn(`[worker] activity report failed: ${error.message}`);
  }
}

/**
 * Write the NEXT step into the running choreo: `line` is what that step should do or say.
 * Only works when the worker is configured to run on a copy of the choreo (`requiresChoreoCopy`),
 * so a session never changes the authored choreo. Always inserts after `insertAfterStepGuid`.
 */
export async function insertStep(body, line, actorRef) {
  const { context, endpoints } = body.config;
  const response = await fetch(endpoints.choreoStepsUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      after: context.insertAfterStepGuid,
      line,
      ...(actorRef ? { actorRef } : {}),
    }),
  });
  if (response.status !== 202) {
    throw new Error(`insertStep: ${response.status} ${await response.text()}`);
  }
}

async function graphql(url, bearer, query, variables) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    throw new Error(
      `GraphQL ${response.status}: ${json.errors?.map((e) => e.message).join('; ') ?? response.statusText}`,
    );
  }
  return json.data;
}
