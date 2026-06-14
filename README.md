# Codex Project Memory

Local repository memory for Codex. It indexes TypeScript/JavaScript structure into local SQLite, exposes compact MCP tools, and renders deterministic SVG/map frames.

## What v0.1 does

- Stores memory locally under `.codex/memory`.
- Indexes TypeScript/JavaScript files, symbols, routes, modules, warnings and duplicate candidates.
- Exposes MCP tools: `memory.head`, `memory.query`, `memory.duplicates`, `memory.frame`, `memory.refresh`, `memory.diff`.
- Produces deterministic SVG and map JSON. PNG export is best-effort and optional.

## What v0.1 does not do

- No embeddings or vector DB.
- No cloud backend.
- No dashboard.
- No direct source-code modifications.
- No required LLM in the core runtime.

## Development

```bash
npm install
npm run build
npm test
node dist/cli/pmem.js --help
```

## Local repository setup

```bash
pmem init --json
pmem index --json
pmem render --json
pmem head --json
```

## MCP setup

Use `.mcp.json` with server name `project-memory` and command `node dist/mcp/server.js`.

## Hook trust

The plugin includes hook definitions in `hooks/hooks.json`. Review the commands before enabling them. Hooks are conservative: prompt hooks do not scan/index/render, Stop uses a loop guard, and all hook output is JSON-only.

## Duplicate guard

Before creating services, controllers, DTOs, routes, tables, modules, repositories, adapters, jobs or utilities, run:

```bash
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
```
