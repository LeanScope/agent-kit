# Contributing to the LeanScope Agent Kit

This file is for changing the kit itself, whether you are a person or a coding agent. To use the
kit, start with the [README](README.md).

## Every change

- **Release notes.** Every change a kit user can notice gets an entry at the top of
  [RELEASES.md](RELEASES.md), written for kit users: what changed and what they have to do, if
  anything. Write the entry as part of the change, once it has been tested, not before.
- **Version.** These four manifests carry one version, and they change together:
  - `.claude-plugin/plugin.json`
  - `.claude-plugin/marketplace.json`
  - `.codex-plugin/plugin.json`
  - `.cursor-plugin/plugin.json`

  Raise the third number for fixes and small improvements, the second for new features or
  changed behaviour. The maintainer changes the first number. The RELEASES.md heading uses the
  same version.
- **Documentation.** The README is the documentation. When a change makes something in it wrong,
  fix or remove that part. Add new sections only when the change needs them.

## Keep out of commits

- Tokens and API keys, real or example. `.env.example` lists names only, and a secret scan runs
  on every push.
- `tasks/`. It is gitignored and holds local plans and notes.
