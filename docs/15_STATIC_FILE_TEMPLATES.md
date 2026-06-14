# Codex Project Memory Plugin — static file templates v0.1

**Stato:** template statici autoritativi per P0/P1/P8.  
**Scopo:** permettere a un agente non creativo di creare artifact copiabili senza inventare formato.  
**Regola:** i contenuti sotto sono fonte autoritativa per file statici. Le funzioni builder/validator di `src/plugin/**` e `src/agents/templates.ts` devono produrre contenuti semanticamente equivalenti e test snapshot stabili.

---

## 1. Regole generali

- Tutti i path sono relativi al plugin root o al project root, mai assoluti.
- JSON statici devono essere parseable e compatti o pretty deterministici.
- Non aggiungere campi non documentati salvo aggiornamento di `16_PUBLIC_SCHEMAS.md`.
- Non scaricare asset remoti.
- Gli hook sono installabili solo dopo review/trust utente.
- I subagenti sono opzionali, read-only e mai core path.

---

## 2. `package.json`

File: `package.json`

```json
{
  "name": "codex-project-memory",
  "version": "0.1.0",
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
  "version": "0.1.0",
  "description": "Local repository memory for Codex with SQLite, deterministic frames, MCP tools and conservative hooks.",
  "author": {
    "name": "Project Memory Maintainers"
  },
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "keywords": ["codex", "memory", "mcp", "repository"],
  "interface": {
    "displayName": "Codex Project Memory",
    "shortDescription": "Local repository memory for Codex.",
    "longDescription": "Indexes repository structure into local SQLite, exposes compact MCP tools, renders deterministic SVG maps and provides conservative hooks.",
    "developerName": "Project Memory Maintainers",
    "category": "Productivity",
    "capabilities": ["MCP", "CLI", "Hooks"],
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
hooks are kept in hooks/hooks.json but not declared in plugin.json because Codex app validation rejects hooks in v0.1 packaging
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

## 8. `hooks/hooks.json`

File: `hooks/hooks.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${PLUGIN_ROOT}/dist/hooks/user-prompt-submit.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${PLUGIN_ROOT}/dist/hooks/post-tool-use.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${PLUGIN_ROOT}/dist/hooks/stop.js"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${PLUGIN_ROOT}/dist/hooks/subagent-stop.js"
          }
        ]
      }
    ]
  }
}
```

Validation:

```text
JSON parse ok
all 4 hook names present
all commands point to dist/hooks/*.js
no hook command mutates source directly
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

1. Call `memory.head` before planning implementation.
2. If status is `not_initialized`, ask the user to run or approve `pmem init --json`.
3. For any code-change intent, call `memory.query` with the user intent.
4. Before creating a service, controller, DTO, route, table, module, repository, adapter, job or utility, call `memory.duplicates`.
5. Prefer the files, symbols, constraints and warnings returned by project-memory over broad repository search.
6. Use `memory.frame` when a visual frame helps locate modules or risks.
7. After changes, use `memory.refresh` or `pmem refresh --changed-only --json` when appropriate.

## Hard rules

- Do not read `.codex/memory/memory.db` directly.
- Do not dump broad source files into the answer.
- Do not create duplicate artifacts when `memory.duplicates` returns high risk.
- Do not rely on PNG existing; SVG and map JSON are the primary frame artifacts.
- Do not treat optional subagents as required runtime.
- Do not modify source code from hooks or memory tools.

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

Hook execution must be reviewed and trusted by the user before activation. Hooks are designed to be conservative, no-op safe and non-invasive.
````

Validation:

```text
starts with YAML frontmatter
mentions memory.head, memory.query, memory.duplicates
states do not read memory.db directly
states hooks require trust/review
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
