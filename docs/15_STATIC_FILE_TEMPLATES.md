# Codex Project Memory Plugin — static file templates v0.2

**Stato:** template statici autoritativi per P0/P1/P8.  
**Scopo:** permettere a un agente non creativo di creare artifact copiabili senza inventare formato.  
**Regola:** i contenuti sotto sono fonte autoritativa per file statici. Le funzioni builder/validator di `src/plugin/**` e `src/agents/templates.ts` devono produrre contenuti semanticamente equivalenti e test snapshot stabili.

---

## 1. Regole generali

- Tutti i path sono relativi al plugin root o al project root, mai assoluti.
- JSON statici devono essere parseable e compatti o pretty deterministici.
- Non aggiungere campi non documentati salvo aggiornamento di `16_PUBLIC_SCHEMAS.md`.
- Non scaricare asset remoti.
- Il lifecycle del plugin usa solo primitive supportate da Codex app: skill implicita e tool MCP.
- I subagenti sono opzionali, read-only e mai core path.

---

## 2. `package.json`

File: `package.json`

```json
{
  "name": "codex-project-memory",
  "version": "0.2.0",
  "type": "module",
  "private": true,
  "description": "Local project memory plugin for Codex using SQLite, deterministic SVG frames and MCP tools.",
  "bin": {
    "pmem": "dist/cli/pmem.js"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/cli/pmem.ts",
    "mcp": "node dist/mcp/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "*",
    "better-sqlite3": "*",
    "commander": "*",
    "fast-glob": "*",
    "picomatch": "*",
    "ts-morph": "*",
    "zod": "*"
  },
  "optionalDependencies": {
    "sharp": "*"
  },
  "devDependencies": {
    "@types/better-sqlite3": "*",
    "@types/node": "*",
    "tsx": "*",
    "typescript": "*",
    "vitest": "*"
  }
}
```

Validation:

```text
npm install creates package-lock.json
npm run build exists
npm test exists
package name/version match 01 defaults
no dependency outside allowlist
```

---

## 3. `tsconfig.json`

File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test", "test/fixtures"]
}
```

---

## 4. `vitest.config.ts`

File: `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    restoreMocks: true
  }
});
```

---

## 5. `bin/pmem`

File: `bin/pmem`

```sh
#!/usr/bin/env sh
set -eu
PLUGIN_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec node "$PLUGIN_ROOT/dist/cli/pmem.js" "$@"
```

Validation:

```text
chmod +x bin/pmem
bin/pmem --help works after npm run build
```

---

## 6. `.codex-plugin/plugin.json`

File: `.codex-plugin/plugin.json`

```json
{
  "name": "codex-project-memory",
  "version": "0.2.0",
  "description": "Local repository memory for Codex with SQLite, deterministic frames, MCP tools and an implicit skill lifecycle.",
  "author": {
    "name": "Project Memory Maintainers"
  },
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "keywords": ["codex", "memory", "mcp", "repository"],
  "interface": {
    "displayName": "Codex Project Memory",
    "shortDescription": "Local repository memory for Codex.",
    "longDescription": "Indexes repository structure into local SQLite, exposes compact MCP tools, renders deterministic SVG maps and uses Codex-supported implicit skill invocation as the project lifecycle.",
    "developerName": "Project Memory Maintainers",
    "category": "Productivity",
    "capabilities": ["MCP", "CLI", "Implicit Skill"],
    "defaultPrompt": [
      "Query project memory before implementing.",
      "Check duplicate risk for a new service.",
      "Refresh project memory after code changes."
    ],
    "brandColor": "#2563EB",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png"
  }
}
```

Validation:

```text
JSON parse ok
name == package.json name
version == package.json version
skills == "./skills/"
mcpServers == "./.mcp.json"
asset paths are relative and inside plugin archive
no hooks field; lifecycle is provided by implicit skill policy plus MCP tools
```

---

## 7. `.mcp.json`

File: `.mcp.json`

```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["dist/mcp/server.js"]
    }
  }
}
```

Validation:

```text
JSON parse ok
contains mcpServers.project-memory
stdio implied by command/args only
no HTTP transport fields
```

---

## 8. Supported lifecycle replacement

Codex app plugin validation does not currently accept plugin-declared hooks. Do not ship a `hooks` field in `.codex-plugin/plugin.json` and do not require `hooks/hooks.json` as a plugin artifact.

The supported replacement is:

```text
skills/repo-memory/SKILL.md contains lifecycle instructions
skills/repo-memory/agents/openai.yaml sets policy.allow_implicit_invocation=true
skills/repo-memory/agents/openai.yaml declares memory.agent and all six granular memory.* MCP tools as dependencies
```

Lifecycle mapping:

```text
Prompt start -> memory.agent phase=pre_task
Implementation intent -> memory.agent phase=pre_task
New artifact intent -> memory.agent phase=pre_create with artifact
After source changes -> memory.agent phase=post_change
Visual orientation -> memory.agent phase=orient
Review/closeout -> memory.agent phase=review
```

---

## 9. `skills/repo-memory/SKILL.md`

File: `skills/repo-memory/SKILL.md`

````md
---
name: repo-memory
description: Use Codex Project Memory in repositories with the project-memory MCP server installed.
---

# Repo Memory

Use this skill when working in a repository that has Codex Project Memory installed.

## Core workflow

1. Prefer `memory.agent` for project-memory lifecycle orchestration.
2. Use granular tools only when debugging or when a narrower read is enough.
3. Before creating a service, controller, DTO, route, table, module, repository, adapter, job or utility, pass an `artifact` to `memory.agent`.
4. Prefer the files, symbols, constraints and warnings returned by project-memory over broad repository search.
5. After changes, use `memory.agent` with `phase: "post_change"` or `pmem agent run --phase post_change --json`.

## Supported lifecycle

Codex app plugin validation does not currently accept plugin-declared hooks. Use this implicit skill plus MCP tools as the supported project lifecycle:

- Prompt start: call `memory.agent` with `phase: "pre_task"`.
- Implementation intent: call `memory.agent` with the user request before editing.
- New artifact intent: call `memory.agent` with `phase: "pre_create"` and `artifact`.
- After source changes: call `memory.agent` with `phase: "post_change"`.
- Visual orientation: call `memory.agent` with `phase: "orient"`.
- Review/closeout: call `memory.agent` with `phase: "review"`.

## Hard rules

- Do not read `.codex/memory/memory.db` directly.
- Do not dump broad source files into the answer.
- Do not create duplicate artifacts when `memory.duplicates` returns high risk.
- Do not rely on PNG existing; SVG and map JSON are the primary frame artifacts.
- Do not treat optional subagents as required runtime.
- Do not modify source code from memory tools.

## Useful commands

```bash
pmem head --json
pmem query "<intent>" --json
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
pmem frame current --json
pmem refresh --changed-only --json
pmem diff --json
```

## Trust note

This plugin does not install lifecycle hooks through `.codex-plugin/plugin.json`. The supported lifecycle is the implicit skill policy above plus `memory.agent` and the granular MCP tools exposed by `project-memory`.
````

Validation:

```text
starts with YAML frontmatter
mentions memory.agent, memory.head, memory.query, memory.duplicates
states do not read memory.db directly
states supported lifecycle replacement
contains no project-specific memory facts
```

---

## 10. `skills/repo-memory/agents/openai.yaml`

File: `skills/repo-memory/agents/openai.yaml`

```yaml
interface:
  display_name: Repo Memory
  short_description: Use project-memory MCP tools for repository context and duplicate checks.
  brand_color: "#2563EB"
  default_prompt: Check project memory before implementing this change.
policy:
  allow_implicit_invocation: true
dependencies:
  tools:
    - memory.agent
    - memory.head
    - memory.query
    - memory.duplicates
    - memory.frame
    - memory.refresh
    - memory.diff
```

---

## 11. `README.md` required sections

File: `README.md`

````md
# Codex Project Memory

Local repository memory for Codex. It indexes TypeScript/JavaScript structure into local SQLite, exposes compact MCP tools, and renders deterministic SVG/map frames.

## What v0.2 does

- Stores memory locally under `.codex/memory`.
- Indexes TypeScript/JavaScript files, symbols, routes, modules, warnings and duplicate candidates.
- Exposes MCP tools: `memory.agent`, `memory.head`, `memory.query`, `memory.duplicates`, `memory.frame`, `memory.refresh`, `memory.diff`.
- Produces deterministic SVG and map JSON. PNG export is best-effort and optional.

## What v0.2 does not do

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

## Supported project lifecycle

Codex app plugin validation does not currently support plugin-declared hooks. The plugin uses a supported replacement: implicit skill invocation plus MCP tools. On project work, Codex should call `memory.agent` as the preferred lifecycle entrypoint and use granular tools for focused reads/debugging.

## Duplicate guard

Before creating services, controllers, DTOs, routes, tables, modules, repositories, adapters, jobs or utilities, run:

```bash
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
```
````

---

## 12. Placeholder PNG assets

Files:

```text
assets/icon.png
assets/logo.png
```

Use this 1x1 transparent PNG base64 for both placeholders unless a real reviewed asset is supplied:

```text
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=
```

Validation:

```text
file exists
PNG magic bytes 89 50 4E 47
not a remote URL
not a font
```

---

## 13. Subagent template: `pmem-retriever.toml`

File: `templates/agents/pmem-retriever.toml`

```toml
name = "pmem_retriever"
description = "Read-only project memory retrieval agent. Use it to locate exact modules, files and symbols before implementation."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use the project-memory MCP server first.
Call memory.head, then memory.query with the requested intent.
Return strict JSON-compatible findings: modules, files, symbols, constraints, warnings.
Do not edit files.
Do not dump broad repository context.
Do not read memory.db directly.
"""
```

---

## 14. Subagent template: `pmem-duplicate-checker.toml`

File: `templates/agents/pmem-duplicate-checker.toml`

```toml
name = "pmem_duplicate_checker"
description = "Read-only duplicate guard agent. Use before creating services, controllers, DTOs, routes, tables, modules or utilities."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.duplicates with the requested artifact kind and intent.
Return risk, verdict, matches and recommendation.
Do not edit files.
Do not approve creation when high-risk matches exist.
Do not read memory.db directly.
"""
```

---

## 15. Subagent template: `pmem-architecture-reviewer.toml`

File: `templates/agents/pmem-architecture-reviewer.toml`

```toml
name = "pmem_architecture_reviewer"
description = "Read-only architecture review agent for checking constraints and memory drift."
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.head and memory.query.
Check whether proposed changes respect module ownership, critical rules and duplicate guard findings.
Return concise JSON-compatible warnings and recommendations.
Do not edit files.
Do not read memory.db directly.
"""
```

Validation for all TOML templates:

```text
name exactly as above
sandbox_mode == "read-only"
contains "Do not edit files"
contains "Do not read memory.db directly"
core runtime works without installing these templates
```
