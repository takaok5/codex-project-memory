# Changelog

## 0.2.0 - 2026-06-15

- Added `memory.agent` MCP tool and `pmem agent run` CLI entrypoint.
- Replaced unsupported plugin-declared hooks with Codex-supported implicit skill
  lifecycle guidance and MCP-first orchestration.
- Kept memory project-local under `.codex/memory/`.
- Preserved deterministic SQLite, SVG, map JSON, snapshot, retrieval, duplicate,
  diff, and refresh behavior.
- Validated build, tests, plugin artifacts, local install, and dry-run package.

## 0.1.0 - 2026-06-14

- Implemented local SQLite project memory.
- Added TypeScript/JavaScript scanner and indexer.
- Added deterministic renderer, generated JSON, SVG/map frame outputs, and
  optional PNG generation.
- Added rule-based retrieval and duplicate agents.
- Added MCP stdio server and CLI commands.
