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
