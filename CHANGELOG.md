# Changelog

## 0.5.0 - 2026-06-16

- Added evidence-first `memory.agent` orchestration behind the existing MCP
  surface.
- Added a deterministic intent router with explicit budgets and default-deny
  retrieval.
- Added bounded `contextPack.evidence` and `contextPack.budget` fields while
  preserving existing modules/files/symbols/warnings fields.
- Added internal specialized agents for impact assessment, runtime evidence
  import, memory curation/writer-gating, conflict arbitration and context
  compression.
- Kept a single memory MCP entrypoint for lifecycle orchestration to avoid
  context saturation from multiple memory servers.

## 0.4.2 - 2026-06-15

- Added explicit `doctor` capability status for compiler-assisted diagnostics:
  `capabilities.diagnostics.status`.
- Kept compiler diagnostics degradation non-blocking via
  `capabilities.diagnostics.hardGate=false`.
- Preserved `overallStatus` values for backward compatibility while giving
  adapters a precise field to distinguish optional diagnostics degradation from
  SQLite/schema/runtime failures.

## 0.4.1 - 2026-06-15

- Fixed `memory.agent` / `pmem agent run --phase post_change` failures caused
  by duplicate symbols in the same file.
- Made symbol replacement transactional and deterministic by deduping symbols on
  `(file_id, fqName, kind)` before insert.
- Added regression coverage for duplicate symbol insertion.

## 0.4.0 - 2026-06-15

- Added compiler-assisted lazy diagnostics for the universal language layer.
- Added SQLite schema v3 with a `diagnostics` table and migration from v2
  without losing indexed files, warnings, language capabilities or frames.
- Added normalized diagnostic output with relative POSIX paths, bounded
  messages, severity, source, tool and confidence fields.
- Added `pmem diagnostics --json` with `--language`, `--changed` and
  `--no-install`.
- Added `generated/diagnostics.json`, graph diagnostics and compact snapshot
  diagnostics.
- Extended `pmem doctor` with language-tool cache, lockfile, failed-tool and
  diagnostics checks.
- Kept MCP tool names stable; `memory.query` and `memory.agent` surface relevant
  diagnostics through existing context warnings.

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
