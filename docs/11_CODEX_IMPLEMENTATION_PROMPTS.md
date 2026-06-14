# Codex Project Memory Plugin — prompt operativi per implementazione v0.1

**Stato:** prompt raffinati global-pass5 autonomous-ready, allineati a tutti i contratti `00`–`13`.  
**Uso:** dare a Codex un pass per volta.  
**Regola:** Codex deve leggere `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` e solo le sezioni pertinenti dei contratti specialistici.

---

## Regole comuni per ogni pass

```text
Before coding:
- read docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md for the current phase only
- read docs/04_FUNCTION_CONTRACTS.md for public functions/types in the current phase
- read the specialist contract for the current phase

While coding:
- do not expand v0.1 scope
- do not add cloud, embeddings, vector DB, LLM-required paths or dashboard
- do not make Codex subagents mandatory
- do not modify target repository source code from memory commands
- keep public JSON compact and typed
- keep all public paths relative POSIX

Before finishing:
- npm run build
- npm test
- verify the phase acceptance in docs/10_TEST_PLAN_AND_ACCEPTANCE.md
```

---

## Pass 0 — readiness audit, no codice

```text
Do not implement code in this pass.

Goal:
Verify the docs are internally consistent before coding.

Read:
- docs/00_DOCS_INDEX.md
- docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md sections 0, 2.9, 2.10
- docs/04_FUNCTION_CONTRACTS.md sections 2, 3, 8.1, 9
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md section 9
- docs/13_OPEN_ITEMS_AND_GUARDS.md

Check:
- no unknown public type names in 04 signatures
- retrieval and duplicate scoring match between 04 and 09
- ProjectMemoryConfig has criticalRules
- RouteRecord/SymbolEdgeRecord owner ids match 05
- PNG is nullable everywhere
- forbidden tables/commands are not required anywhere
- fixture in 12 is concrete enough for AST tests

Output:
- a short pass/fail report
- no code changes unless docs are inconsistent
```

## Modalità agente stupido per tutti i pass

```text
Use defaults without asking:
- package name codex-project-memory
- version 0.1.0
- CLI pmem
- MCP server project-memory
- Node.js 20+ ESM
- better-sqlite3 store
- ts-morph indexer
- zod validation
- SVG/map primary, PNG optional via sharp best-effort

Never do:
- implement extra commands/tools/tables
- use cloud/LLM/embedding/core subagents
- change source code from memory commands
- return code dumps in context packs
- make PNG a hard requirement

When missing a detail:
1. search current docs 00-13;
2. use default from 01/13 if present;
3. keep helper private if no public API needed;
4. update docs before adding public API.
```

---

## Pass 1 — P0 + P1

```text
Implement only P0 and P1 from docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md.

Goal:
Create the buildable TypeScript scaffold for codex-project-memory and the Codex plugin packaging skeleton.

Read first:
- docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md sections P0 and P1
- docs/04_FUNCTION_CONTRACTS.md sections P0 and P1
- docs/06_CLI_CONTRACTS.md sections 1-3 only
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P0/P1

Do:
- package.json with build/test/dev/mcp scripts and defaults from docs/01 section 2.10
- dependencies limited to the allowed set in docs/01 section 2.10
- tsconfig.json with strict TypeScript and Node.js 20+ ESM
- vitest.config.ts
- bin/pmem executable shim
- src/cli/pmem.ts with --help and --version
- src/shared/version.ts
- src/shared/errors.ts with PmemError/PmemErrorCode/toErrorPayload
- minimal shared json/time/path helpers required by CLI bootstrap
- .codex-plugin/plugin.json
- .mcp.json pointing to dist/mcp/server.js over stdio
- skills/repo-memory/SKILL.md
- skills/repo-memory/agents/openai.yaml
- assets placeholder files if needed
- README install/dev/supported lifecycle section

Do not:
- implement scanner
- implement SQLite schema beyond compile-safe placeholder imports
- implement renderer
- implement MCP tools beyond compile-safe placeholder if needed
- implement unsupported plugin hook behavior
- add commands not listed in docs/06_CLI_CONTRACTS.md

Validation:
- npm install
- npm run build
- npm test
- node dist/cli/pmem.js --help
- node dist/cli/pmem.js --version
- validate plugin manifest and .mcp.json snapshots

Keep changes small and coherent.
```

---

## Pass 2 — P2

```text
Implement P2 from docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md.

Goal:
Add repo-local memory runtime, config and SQLite store.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P2 rows
- docs/05_DATA_MODEL_SQLITE.md
- docs/06_CLI_CONTRACTS.md init/doctor/head sections
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P2

Do:
- project root locator
- memory path resolver
- path safety helpers
- config loader/default writer/schema validation
- schema.sql with exactly the documented v1 core tables and indexes
- SQLite open/ensureSchema/transaction helpers
- enable and verify PRAGMA foreign_keys=ON
- minimal repositories for project_state, modules, files, symbols, frames, warnings
- hard delete cascade helper for files
- warning fingerprint helper
- pmem init
- pmem doctor
- pmem head --json

Do not:
- create features table
- create embeddings/vectors/source_chunks tables
- implement soft delete/deleted_at for files
- implement scanner/indexer beyond placeholders
- implement renderer beyond placeholders
- implement MCP server tools beyond compile-safe placeholder if needed
- perform destructive migrations

Validation:
- npm run build
- npm test
- create a temp fixture repo
- pmem init --json creates .codex/memory
- pmem doctor --json returns ok
- pmem head --json returns compact project state
- schema introspection shows no features table
- FK pragma test passes
```

---

## Pass 3 — P3

```text
Implement P3 scanner and TS/JS AST indexer.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P3 rows
- docs/05_DATA_MODEL_SQLITE.md changed-only, warning lifecycle and edge rules
- docs/06_CLI_CONTRACTS.md scan/index sections
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P3

Do:
- scanProjectFiles with include/exclude
- hashFile
- classifyLanguage/isTestFile/isGeneratedFile
- inferModuleId
- indexFileAst using ts-morph
- extract class/function/method/interface/type/enum symbols
- extract resolved import/export edges only
- emit unresolved imports as warning unresolved_import, not symbol_edges rows
- infer NestJS routes for literal decorators
- replace symbols/routes/tests/warnings per file
- hard delete cascade for deleted files in changed-only
- pmem scan
- pmem index

Do not:
- add embeddings/vector DB
- add multi-language tree-sitter
- fail whole index for one bad file
- persist unresolved textual edges
- append duplicate warnings endlessly

Validation:
- npm run build
- npm test
- pmem scan --json on fixture
- pmem index --json on fixture
- pmem index --changed --json skips unchanged files
- deleted file removes stale symbols/routes/warnings
- unresolved import produces warning only
```

---

## Pass 4 — P4

```text
Implement P4 generated JSON and deterministic renderer.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P4 rows
- docs/08_RENDERER_VISUAL_CONTRACT.md
- docs/06_CLI_CONTRACTS.md render/frame sections
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P4

Do:
- buildNormalizedGraph from SQLite
- canonicalize graph and compute sourceHash excluding timestamps
- write generated/project.json, files.json, symbols.json, modules.json
- implement deterministic SVG template and grid layout
- render overview/modules/duplicates/risks/current frames
- write map JSON sidecars with id/bbox/paths/commands
- export PNG best-effort
- set png=null / png_path=NULL when PNG disabled or failed
- register frames in DB
- pmem render
- pmem frame

Do not:
- use AI image generation
- use random/force-directed layout
- make PNG required for success
- store path assoluti in output
- dump source code into generated JSON

Validation:
- npm run build
- npm test
- pmem render --json creates current.svg/current.map.json
- current.png is optional; if missing, png=null is accepted
- repeated render is stable byte-for-byte for SVG
- PNG failure is warning only
- map/SVG ids match
```

---

## Pass 5 — P5

```text
Implement P5 rule-based micro-agent dispatcher.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P5 rows
- docs/09_AGENTS_AND_HOOKS_CONTRACT.md sections 0-2
- docs/06_CLI_CONTRACTS.md query/duplicates sections
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P5

Do:
- AgentName/Input/Output schemas
- dispatchAgent
- retrieval-agent with documented token/path/module/symbol/route/test scoring
- deterministic tie-break score desc, path asc, symbol name asc
- duplicate-agent with documented thresholds high>=0.80, medium>=0.45, low<0.45
- exact duplicate override for same kind/name/module
- drift-agent
- architecture-agent minimal using config criticalRules/modules
- render-agent wrapper with png nullable support
- retrieval_logs writes
- wire pmem query and pmem duplicates to agents

Do not:
- call external models by default
- return long prose
- exceed context limits
- use subagents as runtime dependency
- let high-risk duplicates return create_new_artifact
- read non-existent features table

Validation:
- npm run build
- npm test
- pmem query scenario returns expected files
- pmem duplicates high-risk on duplicate Access service
- scoring order is deterministic
- output contains no code dump and no absolute paths
```

---

## Pass 6 — P6

```text
Implement P6 MCP server and tools.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P6 rows
- docs/07_MCP_TOOL_CONTRACTS.md
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P6

Do:
- MCP server bootstrap over stdio
- tool schemas for exactly six tools
- memory.head
- memory.query
- memory.duplicates
- memory.frame
- memory.refresh
- memory.diff
- handlers return typed objects and throw PmemError on failure
- server maps PmemError to structured MCP error payloads
- no stdout prose outside protocol
- frame/visualFrame shape { svg, png, map } with png nullable

Do not:
- expose direct DB dump tools
- expose SQL tools
- return source code dumps
- require initialized memory for memory.head
- render implicitly from memory.frame
- make PNG required

Validation:
- npm run build
- npm test
- MCP server starts via npm run mcp
- tool list contains exactly six tools
- memory.head works before init
- memory.frame returns png=null when PNG absent
- errors use canonical PmemErrorCode
```

---

## Pass 7 — P7 + P8

```text
Implement P7 supported lifecycle and P8 optional Codex subagent templates.

Read first:
- docs/04_FUNCTION_CONTRACTS.md P7/P8 rows
- docs/09_AGENTS_AND_HOOKS_CONTRACT.md agent/lifecycle sections
- docs/06_CLI_CONTRACTS.md agents install/list sections
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md P7/P8

Do:
- skills/repo-memory/SKILL.md documents supported lifecycle mapping
- skills/repo-memory/agents/openai.yaml sets allow_implicit_invocation=true
- agent YAML declares exactly memory.head/query/duplicates/frame/refresh/diff dependencies
- lifecycle maps prompt start to memory.head
- lifecycle maps implementation intent to memory.query
- lifecycle maps new artifact intent to memory.duplicates
- lifecycle maps source-change closeout to memory.refresh changedOnly=true render=true
- lifecycle maps final review to memory.diff when useful
- templates/agents/*.toml with read-only instructions
- pmem agents install --scope project
- pmem agents list
- README supported lifecycle docs

Do not:
- add unsupported plugin-declared hooks
- make subagents mandatory
- let retriever/duplicate agents edit files
- bypass the six MCP tools for lifecycle actions

Validation:
- npm run build
- npm test
- plugin validator accepts manifest, skill and agent YAML
- skill docs include supported lifecycle replacement
- agents install creates files and does not overwrite without --force
- subagent templates are read-only and MCP-first
```

---

## Pass 8 — P9

```text
Implement P9 tests, fixture and demo.

Read first:
- docs/10_TEST_PLAN_AND_ACCEPTANCE.md
- docs/12_DEMO_SCENARIO.md
- docs/13_OPEN_ITEMS_AND_GUARDS.md

Do:
- create test/fixtures/nest-basic
- complete tests for store, scanner, AST, renderer, agents, MCP tools, lifecycle artifacts
- create demo walkthrough/script
- ensure all acceptance commands pass
- verify current.svg/current.map.json exist
- accept current.png only if PNG export is available
- verify png=null + png_export_failed is valid success when PNG export fails
- verify query and duplicate outputs match demo expectations

Do not:
- expand beyond v0.1 scope
- add UI/dashboard/embeddings/vector DB
- require subagents, LLM or cloud backend
- make PNG mandatory

Validation:
- npm run build
- npm test
- run documented demo commands
- verify no public absolute paths
- verify no source code dumps in context pack/MCP
```

---

## Emergency prompt — fix only

```text
Fix only the failing build/test errors from the previous pass.

Do not add new features.
Do not change public contracts unless the docs are inconsistent and you update them explicitly.
Keep the patch minimal.
Run npm run build and npm test.
```
