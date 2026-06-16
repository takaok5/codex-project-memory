# Codex Project Memory

Local repository memory for Codex. It indexes project structure into local SQLite, exposes compact MCP tools, and renders deterministic SVG/map frames.

## What v0.5 does

- Stores memory locally under `.codex/memory`.
- Indexes TypeScript/JavaScript deeply with `ts-morph`.
- Detects a broad programming-language set and structurally indexes Python, Go, Java, C#, PHP, Ruby, Rust, C/C++, Kotlin, Swift, Shell, Dart, Scala, R, Lua, Elixir, Clojure, SQL, HTML/CSS and additional common languages.
- Writes explicit language capability flags so fallback/degraded analysis is visible in generated JSON and snapshots.
- Lazily uses user-space language analyzers from `.codex/memory/cache/language-tools` when available or installable; it never changes global system PATH or installs system packages.
- Runs compiler-assisted diagnostics when possible and stores normalized diagnostics in SQLite schema v3 plus `generated/diagnostics.json`.
- Uses a single `memory.agent` orchestrator with internal specialized agents: intent router, evidence retriever, duplicate sentinel, impact assessor, runtime evidence importer, writer gate, conflict arbiter and context compressor.
- Retrieves project context with explicit evidence budgets and default-deny filtering, rather than broad semantic memory dumps.
- Exposes MCP tools: `memory.agent`, `memory.head`, `memory.query`, `memory.duplicates`, `memory.frame`, `memory.refresh`, `memory.diff`.
- Adds CLI diagnostics: `pmem diagnostics --json`, with `--language`, `--changed`, and `--no-install`.
- Provides `pmem agent run` as the project-local orchestration entrypoint.
- Produces deterministic SVG and map JSON. PNG export is best-effort and optional.

## Runtime Requirements

- Node.js 20 or newer.
- Codex with plugin and MCP support.
- `sharp` is optional. If PNG generation is unavailable, SVG and map JSON remain the required visual outputs.

## What v0.5 does not do

- No embeddings or vector DB.
- No cloud backend.
- No dashboard.
- No direct source-code modifications.
- No required LLM in the core runtime.
- No second memory MCP server for the same project context.
- No claim that fallback analysis is compiler-equivalent for every language; capability flags identify the tier per language.
- No global compiler, SDK, PATH, registry or project lockfile modifications.

## Development

```bash
npm install
npm run build
npm test
node dist/cli/pmem.js --help
```

Before packaging or sharing:

```bash
npm ci
npm run build
npm test
npm run marketplace:sync
node dist/cli/pmem.js --help
node dist/cli/pmem.js --version
npm pack --dry-run
```

## Local repository setup

```bash
pmem init --json
pmem index --json
pmem render --json
pmem head --json
```

## MCP setup

Use `.mcp.json` with server name `project-memory`. The server command is
`node scripts/bootstrap-mcp.mjs`; on first start, the bootstrap installs runtime
dependencies in the installed plugin folder if they are missing, then starts
`dist/mcp/server.js`.

## Codex Plugin Distribution

This repository is a single-plugin Codex marketplace root. The marketplace file
is `.agents/plugins/marketplace.json`, and its plugin entry points at
`./plugins/codex-project-memory`.

Before sharing changes, regenerate the distributable plugin folder:

```bash
npm run build
npm run marketplace:sync
```

From a public or private Git repository:

```bash
codex plugin marketplace add owner/codex-project-memory --ref main
```

From a local clone:

```bash
codex plugin marketplace add /absolute/path/to/codex-project-memory
```

After adding the marketplace, open the Codex Plugin Directory, select
**Codex Project Memory**, install the plugin, and start a new thread. On first
MCP startup the plugin runs `npm ci --omit=dev` inside the installed plugin
folder so users do not need to prepare `node_modules` manually. That first
startup needs access to the npm registry or an already-warm npm cache.

More detail: `docs/MARKETPLACE_SHARING.md`.

This repository includes:

- `.agents/plugins/marketplace.json`
- `plugins/codex-project-memory/`
- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/repo-memory/SKILL.md`
- built runtime under `dist/` after `npm run build`
- `PRIVACY.md`
- `SECURITY.md`
- `CHANGELOG.md`

## Supported project lifecycle

Codex app plugin validation does not currently support plugin-declared hooks. The plugin uses a supported replacement: implicit skill invocation plus MCP tools. On project work, Codex should call `memory.head`, use `memory.query` before edits, use `memory.duplicates` before new artifacts, and call `memory.refresh` after source changes.

In v0.5 the preferred entrypoint is `memory.agent`, or the CLI equivalent:

```bash
pmem agent run "<intent>" --json
pmem agent run "<intent>" --phase pre_create --kind service --module <moduleId> --name <ProposedName> --json
```

## Duplicate guard

Before creating services, controllers, DTOs, routes, tables, modules, repositories, adapters, jobs or utilities, run:

```bash
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
```

## Demo Walkthrough

From a copy of `test/fixtures/nest-basic` after `npm run build`:

```bash
node /path/to/MemoryCodex/dist/cli/pmem.js init --json
node /path/to/MemoryCodex/dist/cli/pmem.js doctor --json
node /path/to/MemoryCodex/dist/cli/pmem.js scan --json
node /path/to/MemoryCodex/dist/cli/pmem.js index --json
node /path/to/MemoryCodex/dist/cli/pmem.js diagnostics --no-install --json
node /path/to/MemoryCodex/dist/cli/pmem.js render --json
node /path/to/MemoryCodex/dist/cli/pmem.js head --json
node /path/to/MemoryCodex/dist/cli/pmem.js agent run "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento e sospeso." --json
node /path/to/MemoryCodex/dist/cli/pmem.js query "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento e sospeso." --visual --json
node /path/to/MemoryCodex/dist/cli/pmem.js agent run "AccessValidationService / verifica diritto accesso" --phase pre_create --kind service --module access --name AccessValidationService --json
node /path/to/MemoryCodex/dist/cli/pmem.js duplicates --kind service --module access --name AccessValidationService "AccessValidationService / verifica diritto accesso" --json
node /path/to/MemoryCodex/dist/cli/pmem.js frame current --json
node /path/to/MemoryCodex/dist/cli/pmem.js refresh --changed-only --json
node /path/to/MemoryCodex/dist/cli/pmem.js diff --json
```

The duplicate command should return `risk: "high"` and `verdict: "extend_existing_artifact"` for `AccessService`.
