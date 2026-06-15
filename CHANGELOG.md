# Changelog

## 0.3.0 - 2026-06-15

- Added universal language detection with wildcard `scan.languages`.
- Added structural fallback indexing for Python, Go, Java, C#, PHP, Ruby, Rust,
  C/C++, Kotlin, Swift, Shell, Dart, Scala, R, Lua, Elixir, Clojure, SQL,
  HTML/CSS and additional common languages.
- Added SQLite schema v2 with per-file `analysis_json` and aggregated
  `language_capabilities`.
- Added generated language capability JSON and snapshot language/tier metadata.
- Added user-space language analyzer orchestration under
  `.codex/memory/cache/language-tools` without global/system installs.

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
