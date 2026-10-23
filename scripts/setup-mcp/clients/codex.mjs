// OpenAI Codex: `.codex/config.toml` in the project (read in trusted projects only). Codex can't
// prompt; it reads the token via `bearer_token_env_var` and the keys via `env_http_headers`.
//
// Rather than parse and re-serialise a TOML file this script doesn't own, it owns ONE block between
// two marker lines and replaces exactly that block on every run. The rest of the file is never
// touched or reformatted.

import { join } from 'node:path';
import { SERVERS, secret, selectedSecrets, url } from '../catalog.mjs';

const BEGIN = '# >>> leanscope agent-kit (managed by scripts/setup-mcp.mjs) >>>';
const END = '# <<< leanscope agent-kit <<<';

export default {
  id: 'codex',
  name: 'Codex',
  target: ({ project }) => join(project, '.codex', 'config.toml'),

  render(options) {
    const ids = new Set(selectedSecrets(options.keys).map((s) => s.id));
    const sections = SERVERS.map((server) => {
      const lines = [`[mcp_servers.${server.name}]`, `url = "${url(server)}"`];
      const extra = [];
      for (const [header, h] of Object.entries(server.headers)) {
        if (!ids.has(h.secret)) continue;
        if (header === 'Authorization' && h.prefix === 'Bearer ') {
          lines.push(`bearer_token_env_var = "${secret(h.secret).env}"`);
        } else {
          extra.push(`"${header}" = "${secret(h.secret).env}"`);
        }
      }
      if (extra.length > 0) lines.push(`env_http_headers = { ${extra.join(', ')} }`);
      return lines.join('\n');
    });
    return [BEGIN, sections.join('\n\n'), END].join('\n');
  },

  merge(current = '', block) {
    const start = current.indexOf(BEGIN);
    const end = current.indexOf(END);
    if (start >= 0 && end > start) {
      return `${current.slice(0, start)}${block}${current.slice(end + END.length)}`;
    }
    const gap = current ? (current.endsWith('\n') ? '\n' : '\n\n') : '';
    return `${current}${gap}${block}\n`;
  },

  envSecrets: (options) => selectedSecrets(options.keys),
  after: () => 'Codex reads a project .codex/config.toml only when you trust the project.',
};
