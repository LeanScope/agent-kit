// Helpers for clients whose MCP configuration is a JSON file.

/** Parse a JSON config, or start from `{}` when there is none yet. */
export function parse(text, file) {
  if (!text?.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON (${error.message}) — fix it or move it away first`);
  }
}

/** Merge our servers into `config[rootKey]`, keeping every other server and key. */
export function mergeServers(config, rootKey, servers) {
  return { ...config, [rootKey]: { ...(config[rootKey] ?? {}), ...servers } };
}

export const stringify = (value) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Remove the servers `isOurs(name)` picks from every place a config may keep them (`servers`,
 * `mcpServers`, or a bare map), plus inputs whose id starts with `inputPrefix`. Returns the new
 * config, or `undefined` when nothing at all is left (the file can go).
 */
export function removeServers(config, isOurs, inputPrefix) {
  const next = { ...config };
  let wrapped = false;
  for (const key of ['servers', 'mcpServers']) {
    if (!next[key] || typeof next[key] !== 'object') continue;
    wrapped = true;
    const kept = Object.fromEntries(Object.entries(next[key]).filter(([name]) => !isOurs(name)));
    if (Object.keys(kept).length > 0) next[key] = kept;
    else delete next[key];
  }
  if (!wrapped) for (const name of Object.keys(next)) if (isOurs(name)) delete next[name];
  if (Array.isArray(next.inputs)) {
    const kept = next.inputs.filter((i) => !i?.id?.startsWith(inputPrefix));
    if (kept.length > 0) next.inputs = kept;
    else delete next.inputs;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
