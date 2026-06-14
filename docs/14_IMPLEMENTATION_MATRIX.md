# Codex Project Memory Plugin — implementation matrix v0.1

**Stato:** matrice operativa per implementazione autonomous-ready.  
**Scopo:** rendere i pass P0–P9 eseguibili da un agente con bassa capacità di inferenza.  
**Autorità:** questo file non cambia lo scope di `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md`; rende meccanici file, export, test e gate.  
**Regola:** se un file, export pubblico, comando, tool, tabella o output non appare in `01`, `04`, `05`, `06`, `07`, `08`, `09`, `14`, `15`, `16` o `17`, non va inventato.

---

## 0. Gerarchia operativa per agente stupido

Durante l'implementazione, usare questa precedenza locale:

1. `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` per scope e fasi.
2. `04_FUNCTION_CONTRACTS.md` per moduli, funzioni pubbliche e side effect.
3. `16_PUBLIC_SCHEMAS.md` per shape JSON, config, errori, warning e snapshot.
4. `05_DATA_MODEL_SQLITE.md` per schema DB e repository.
5. `06_CLI_CONTRACTS.md` e `07_MCP_TOOL_CONTRACTS.md` per comportamento pubblico.
6. `08_RENDERER_VISUAL_CONTRACT.md` e `09_AGENTS_AND_HOOKS_CONTRACT.md` per renderer, agenti e lifecycle.
7. Questo file per lista file-per-pass, export ammessi e gate.
8. `15_STATIC_FILE_TEMPLATES.md` per contenuto esatto dei file statici.
9. `17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md` per fixture, expected rows e golden output.

Se due fonti danno shape diverse per output pubblico, vince `16_PUBLIC_SCHEMAS.md`. Se due fonti danno file/static template diversi, vince `15_STATIC_FILE_TEMPLATES.md`. Se due fonti danno expected demo diversi, vince `17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md`.

---

## 1. Protocollo obbligatorio per ogni pass

Ogni pass va eseguito con questo algoritmo, senza salto di fase:

```text
1. leggere il blocco del pass in 01
2. leggere il prompt corrispondente in 11
3. leggere la sezione funzione corrispondente in 04
4. leggere questa matrice per il pass
5. leggere 16 per gli output pubblici toccati
6. leggere il contratto specialistico della fase: 05, 06, 07, 08 o 09
7. creare o modificare solo i file elencati nel pass
8. implementare prima tipi e validatori, poi funzioni pure, poi side effect
9. aggiungere test indicati dal pass
10. eseguire i gate indicati
11. non passare al pass successivo se build/test falliscono
```

Regole dure:

- `src/shared/**` non importa moduli interni.
- `src/runtime/**` non importa CLI/MCP.
- `src/store/**` non importa CLI/MCP/renderer.
- `src/indexer/**` non importa CLI/MCP.
- `src/renderer/**` non importa CLI/MCP.
- `src/agents/**` non importa CLI/MCP.
- `src/cli/**` non importa internals MCP protocol.
- `src/mcp/**` non usa `printResult()` o output terminale.

Helper privati sono ammessi solo se restano nello stesso modulo, non diventano API pubblica, non aggiungono side effect e non cambiano shape pubbliche. Ogni helper di path safety, serializzazione, schema, scoring o hashing deve avere test.

---

## 2. Gate comuni

Ogni pass deve terminare almeno con:

```bash
npm run build
npm test
```

Gate aggiuntivi:

| Pass | Comandi aggiuntivi obbligatori |
|---|---|
| Pass 1 | `node dist/cli/pmem.js --help`; `node dist/cli/pmem.js --version`; parse JSON di `.codex-plugin/plugin.json`, `.mcp.json`; validate skill frontmatter e agent YAML |
| Pass 2 | `node dist/cli/pmem.js init --json`; `node dist/cli/pmem.js doctor --json`; `node dist/cli/pmem.js head --json` su temp repo |
| Pass 3 | `node dist/cli/pmem.js scan --json`; `node dist/cli/pmem.js index --json`; `node dist/cli/pmem.js index --changed --json` su fixture |
| Pass 4 | `node dist/cli/pmem.js render --json`; `node dist/cli/pmem.js frame current --json`; validazione SVG/map |
| Pass 5 | `node dist/cli/pmem.js query "access subscription suspended" --json`; `node dist/cli/pmem.js duplicates --kind service --module access --name AccessValidationService "AccessValidationService / verifica diritto accesso" --json` |
| Pass 6 | test handlers MCP `memory.head/query/duplicates/frame/refresh/diff`; tool list include solo i tool v0.1 |
| Pass 7 | lifecycle supportato via skill implicita: `allow_implicit_invocation=true`, dipendenze sui sei tool MCP, subagenti read-only |
| Pass 8 | demo end-to-end su `test/fixtures/nest-basic` |

---

## 3. Pass 1 — P0 + P1, scaffold e plugin artifacts

### 3.1 Leggere prima

```text
01: P0, P1, package/toolchain defaults
04: P0, P1, error boundary, shared/path rules generali
06: regole globali CLI
10: P0/P1 test
15: template statici
16: ErrorPayload, CliResult, plugin/mcp/lifecycle schemas
```

### 3.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso | Note |
|---|---|---|---|
| `package.json` | create | n/a | usare template `15`; no dependency fuori lista |
| `tsconfig.json` | create | n/a | ESM Node 20, strict |
| `vitest.config.ts` | create | n/a | test include `test/**/*.test.ts` |
| `README.md` | create/update | n/a | includere install/dev e supported lifecycle dal template `15` |
| `bin/pmem` | create | n/a | wrapper eseguibile; non sostituisce `dist/cli/pmem.js` |
| `.codex-plugin/plugin.json` | create | n/a | template `15`; path relativi |
| `.mcp.json` | create | n/a | template `15`; server `project-memory` |
| `skills/repo-memory/SKILL.md` | create | n/a | template `15`; solo workflow, non memoria progetto |
| `skills/repo-memory/agents/openai.yaml` | create | n/a | template `15`; `allow_implicit_invocation=true` e dipendenze MCP |
| `assets/icon.png` | create | n/a | placeholder PNG valido; non serve grafica finale |
| `assets/logo.png` | create | n/a | placeholder PNG valido |
| `src/shared/types.ts` | create | enum/type condivisi | copiare tipi canonici da `04` e schema enum da `16` |
| `src/shared/version.ts` | create | `VERSION` | valore `0.1.0`; test contro package |
| `src/shared/errors.ts` | create | `PmemError`, `toErrorPayload` | no stack/path assoluti in payload |
| `src/shared/json.ts` | create | `safeJsonParse`, `writeJson`, `stableStringify` | `stableStringify` ammesso come helper pubblico per hash/schema |
| `src/cli/output.ts` | create | `printResult` | solo JSON compatto con `--json` |
| `src/cli/pmem.ts` | create | `runCli` | niente `process.exit` dentro `runCli` |
| `src/plugin/manifest.ts` | create | `buildPluginManifest`, `validatePluginManifest` | usa schema `16` |
| `src/plugin/mcp-config.ts` | create | `buildMcpConfig`, `validateMcpConfig` | stdio only |
| `src/plugin/skill.ts` | create | `buildRepoMemorySkillDoc` | template render deterministico |
| `src/plugin/assets.ts` | create | `ensureAssetPlaceholders` | no overwrite senza force |
| `src/plugin/validate-artifacts.ts` | create | `validatePluginArtifacts` | gate P1 |
| `test/shared/errors.test.ts` | create | n/a | PmemError/toErrorPayload |
| `test/shared/json.test.ts` | create | n/a | parse/stable stringify |
| `test/cli/help-version.test.ts` | create | n/a | help/version exit 0 |
| `test/plugin/artifacts.test.ts` | create | n/a | JSON parse + validators |

### 3.3 Comandi CLI minimi in questo pass

Implementare solo:

```text
pmem --help
pmem --version
```

I comandi `init/doctor/head/...` possono essere registrati come placeholder solo se ritornano errore `NOT_INITIALIZED` o `VALIDATION_ERROR` coerente, ma non devono simulare side effect non implementati.

### 3.4 Acceptance pass 1

- `npm run build` verde.
- `npm test` verde.
- `node dist/cli/pmem.js --help` exit `0`.
- `node dist/cli/pmem.js --version` stampa `0.1.0` o JSON se supportato con flag futuro.
- Tutti gli artifact statici sono presenti e validabili.
- Nessun path assoluto dentro JSON statici.

---

## 4. Pass 2 — P2, runtime path, config e SQLite store

### 4.1 Leggere prima

```text
01: P2
04: filesystem/path contracts, P2, CLI handlers init/doctor/head
05: schema SQL, project_state, repository base
06: init/doctor/head
16: config schema, snapshot schema, error catalog
```

### 4.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `src/shared/path.ts` | create | `normalizePathSeparators`, `toProjectRelativePosix`, `toMemoryRelativePosix` |
| `src/shared/fs-safety.ts` | create | `assertInsideProjectRoot`, `assertInsideMemoryRoot` |
| `src/shared/fs.ts` | create | `ensureParentDirectory`, `writeFileAtomic` |
| `src/shared/json.ts` | update | `writeJsonFileAtomic`, `stableStringify`, `canonicalJsonHash` |
| `src/runtime/project-locator.ts` | create | `findProjectRoot`, `findGitRoot`, `assertSafeProjectRoot` |
| `src/runtime/memory-paths.ts` | create | `getMemoryPaths`, `ensureMemoryDirectories` |
| `src/runtime/config-loader.ts` | create | `defaultProjectConfig`, `loadProjectConfig`, `writeDefaultProjectConfig`, `validateProjectConfig`, `computeConfigHash` |
| `src/runtime/context.ts` | create | `resolveRuntimeContext` |
| `src/runtime/state-machine.ts` | create | `transitionMemoryState` |
| `src/store/schema.sql` | create | n/a |
| `src/store/sqlite.ts` | create | `openMemoryDb`, `ensureSchema`, `withTransaction` |
| `src/store/project-state-repository.ts` | create | `getProjectState`, `setProjectStateValue`, `markMemoryDirty`, `markMemoryFresh`, `markMemoryError` |
| `src/store/file-repository.ts` | create | `upsertFileRecord`, `listFiles`, `getFileByPath`, `removeFileRecordCascade` |
| `src/cli/commands/init.ts` | create | `cmdInit` |
| `src/cli/commands/doctor.ts` | create | `cmdDoctor` |
| `src/cli/commands/head.ts` | create | `cmdHead` |
| `src/cli/pmem.ts` | update | register `init`, `doctor`, `head` |
| `test/runtime/project-locator.test.ts` | create | n/a |
| `test/runtime/memory-paths.test.ts` | create | n/a |
| `test/runtime/config-loader.test.ts` | create | n/a |
| `test/runtime/state-machine.test.ts` | create | n/a |
| `test/store/sqlite-schema.test.ts` | create | n/a |
| `test/store/project-state-repository.test.ts` | create | n/a |
| `test/store/file-repository.test.ts` | create | n/a |
| `test/cli/init-doctor-head.test.ts` | create | n/a |

### 4.3 Config defaults vincolanti

Usare il default esatto di `16_PUBLIC_SCHEMAS.md`. La config parziale viene merged solo con chiavi documentate. `.codex/memory/**` resta escluso anche se l'utente lo rimuove da `scan.exclude`.

### 4.4 Schema/DB vincolante

- `PRAGMA foreign_keys=ON` a ogni apertura.
- `PRAGMA user_version=1` dopo `ensureSchema`.
- Nessuna tabella `features`.
- `project_state` contiene solo le chiavi elencate in `05`/`16`.
- File cancellati v0.1: hard delete cascade, niente soft delete.

### 4.5 Acceptance pass 2

- `pmem init --json` crea `.codex/memory`, DB, config e subdir.
- `pmem doctor --json` funziona prima e dopo init.
- `pmem head --json` funziona prima di init con `status="not_initialized"`.
- Output JSON validano contro `16`.
- Nessun path assoluto in output.

---

## 5. Pass 3 — P3, scanner e AST indexer

### 5.1 Leggere prima

```text
01: P3
04: P3 scanner/indexer/repository contracts
05: transaction recipes, warning lifecycle, changed-only rules
06: scan/index output
16: warning catalog, public output schema
17: fixture nest-basic expected rows
```

### 5.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `src/store/symbol-repository.ts` | create | `replaceSymbolsForFile`, `searchSymbols`, `getSymbolById` |
| `src/store/edge-repository.ts` | create | `replaceEdgesForFile`, `listEdgesForGraph` |
| `src/store/module-repository.ts` | create | `upsertModule`, `listModules`, `inferModuleForPath` |
| `src/store/route-repository.ts` | create | `replaceRoutesForFile`, `listRoutes` |
| `src/store/test-repository.ts` | create | `replaceTestLinksForFile`, `listTestLinksForSymbol` |
| `src/store/warning-repository.ts` | create | `replaceWarningsForFile`, `resolveWarningsForFile`, `addWarning`, `listActiveWarnings` |
| `src/indexer/scan.ts` | create | `scanProjectFiles` |
| `src/indexer/hash.ts` | create | `hashFile`, `hashContent` |
| `src/indexer/language.ts` | create | `classifyLanguage`, `isTestFile`, `isGeneratedFile` |
| `src/indexer/module-inference.ts` | create | `inferModuleId` |
| `src/indexer/ast-indexer.ts` | create | `indexFileAst`, `extractSymbolsFromSourceFile`, `extractImportExportEdges` |
| `src/indexer/route-indexer.ts` | create | `inferNestRoutes` |
| `src/indexer/dependency-graph.ts` | create | `resolveSymbolEdges` |
| `src/indexer/test-adjacency.ts` | create | `inferTestTargets` |
| `src/indexer/project-indexer.ts` | create | `indexProject`, `indexChangedFiles` |
| `src/cli/commands/scan.ts` | create | `cmdScan` |
| `src/cli/commands/index.ts` | create | `cmdIndex` |
| `src/cli/pmem.ts` | update | register `scan`, `index` |
| `test/fixtures/nest-basic/**` | create | n/a | usare contenuti da `17` |
| `test/indexer/scan.test.ts` | create | n/a |
| `test/indexer/language.test.ts` | create | n/a |
| `test/indexer/module-inference.test.ts` | create | n/a |
| `test/indexer/ast-indexer.test.ts` | create | n/a |
| `test/indexer/route-indexer.test.ts` | create | n/a |
| `test/indexer/project-indexer.test.ts` | create | n/a |
| `test/store/indexer-repositories.test.ts` | create | n/a |
| `test/cli/scan-index.test.ts` | create | n/a |

### 5.3 AST extraction decisioni meccaniche

Queste regole eliminano inferenza libera:

| Tema | Regola v0.1 |
|---|---|
| Estensioni indicizzate | `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts` |
| File troppo grande | se `sizeBytes > config.scan.maxFileBytes`, salvare/aggiornare `files` con hash/size e warning `file_too_large`; non estrarre simboli |
| File non supportato | non indicizzare se fuori `scan.languages`; warning `unsupported_language` solo se il file era incluso dal glob |
| `fqName` top-level class/interface/type/enum/function/const | nome dichiarato, es. `AccessService` |
| `fqName` metodo | `ClassName.methodName`, es. `AccessService.canOpen` |
| `fqName` funzione annidata | non indicizzata in v0.1 |
| Constructor | non indicizzato come simbolo in v0.1 |
| `kind` class con suffisso `Service` | `service` |
| `kind` class con suffisso `Controller` | `controller` |
| `kind` class con suffisso `Repository` | `repository` |
| `kind` interface | `interface` |
| `kind` type alias | `type` |
| `kind` enum | `enum` |
| `kind` method | `method` |
| `kind` function | `function` |
| `kind` const/let/var exported | `const` |
| `exported` metodo | `true` se la classe contenitrice è exported; altrimenti `false` |
| `signature` | dichiarazione senza corpo, whitespace collassato a spazio singolo, max 500 chars |
| `signatureHash` | `sha256:` + hash della signature canonical |
| `bodyHash` | `sha256:` + hash del body text con whitespace collassato; commenti inclusi se presenti nel body text ts-morph |
| Parse error | file resta in `files`, simboli/routes/edges/test link sostituiti con vuoto, warning `parse_error` |
| Import unresolved | non scrivere `symbol_edges`; scrivere warning `unresolved_import` |

### 5.4 Import resolution v0.1

Algoritmo obbligatorio:

```text
1. accettare solo import/export sourceModule string literal
2. se sourceModule inizia con "." o "..": risolvere da directory file sorgente
3. provare, in ordine: exact path, .ts, .tsx, .js, .jsx, .mts, .cts, /index.ts, /index.tsx, /index.js, /index.jsx, /index.mts, /index.cts
4. se risolto a file indicizzato: creare edge risolvibile verso simboli esportati con nome importato
5. se non risolto: warning unresolved_import con source="indexer"
6. se sourceModule non è relativo: in v0.1 non creare edge; creare warning unresolved_import solo se il file è parte della fixture o se config futura non lo esclude; nessun crash
```

### 5.5 NestJS route inference v0.1

Decoratori supportati:

```text
@Controller("prefix")
@Get("path")
@Post("path")
@Put("path")
@Patch("path")
@Delete("path")
```

Regole:

- Solo string literal.
- Path finale: `/${controllerPrefix}/${methodPath}` normalizzato con slash singolo.
- Metodo uppercase.
- Dynamic/non-literal decorator: warning `dynamic_route`, nessuna route.
- Handler symbol: metodo `ControllerClass.methodName` se presente.

### 5.6 Acceptance pass 3

- Fixture `nest-basic` produce moduli e simboli minimi di `17`.
- Route `POST /access/open` e `GET /auth/me` presenti.
- `*.spec.ts` è marcato `isTest=true` e collegato almeno ad `AccessService`.
- `@nestjs/common` e `vitest` non producono edge finti.
- `pmem index --changed --json` senza modifiche produce `skippedUnchanged > 0` e non duplica warning.
- File cancellato sparisce da `files`, `symbols`, `routes`, `tests`, `warnings`, `symbol_edges`.

---

## 6. Pass 4 — P4, generated JSON e renderer

### 6.1 Leggere prima

```text
01: P4
04: P4 renderer contracts
05: frames e snapshot
06: render/frame
08: renderer visual contract
16: FrameMap, NormalizedGraph, RenderOutput, Snapshot schema
17: visual expected outputs
```

### 6.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `src/store/frame-repository.ts` | create | `upsertFrame`, `getFrame`, `listFrames` |
| `src/renderer/graph-builder.ts` | create | `buildNormalizedGraph`, `canonicalizeGraph` |
| `src/renderer/hash.ts` | create | `computeGraphSourceHash` |
| `src/renderer/generated-json.ts` | create | `writeGeneratedJson` |
| `src/renderer/layout.ts` | create | `layoutGraph` |
| `src/renderer/svg-renderer.ts` | create | `renderSvg`, `escapeSvgText`, `truncateLabel` |
| `src/renderer/map-writer.ts` | create | `buildFrameMap`, `writeFrameMap` |
| `src/renderer/frame-registry.ts` | create | `upsertFrame`, `getFrame`, `listFrames` deleganti a store oppure re-export documentato |
| `src/renderer/render-current.ts` | create | `renderCurrentFrame` |
| `src/renderer/render-frames.ts` | create | `renderNamedFrame` |
| `src/renderer/svg-to-png.ts` | create | `exportSvgToPng` |
| `src/runtime/snapshots.ts` | create | `createMemorySnapshot`, `readMemorySnapshot`, `diffMemorySnapshots`, `rotateSnapshotsForWrite` |
| `src/cli/commands/render.ts` | create | `cmdRender` |
| `src/cli/commands/frame.ts` | create | `cmdFrame` |
| `src/cli/commands/diff.ts` | create | `cmdDiff` |
| `src/cli/pmem.ts` | update | register `render`, `frame`, `diff` |
| `test/renderer/graph-builder.test.ts` | create | n/a |
| `test/renderer/layout.test.ts` | create | n/a |
| `test/renderer/svg-renderer.test.ts` | create | n/a |
| `test/renderer/map-writer.test.ts` | create | n/a |
| `test/renderer/render-current.test.ts` | create | n/a |
| `test/runtime/snapshots.test.ts` | create | n/a |
| `test/cli/render-frame-diff.test.ts` | create | n/a |

### 6.3 Generated JSON obbligatori

Scrivere sempre questi file dopo render riuscito:

```text
.codex/memory/generated/project.json
.codex/memory/generated/modules.json
.codex/memory/generated/files.json
.codex/memory/generated/symbols.json
.codex/memory/generated/routes.json
.codex/memory/generated/warnings.json
.codex/memory/generated/edges.json
.codex/memory/generated/duplicates.json
.codex/memory/generated/graph.json
```

I primi quattro restano minimi per compatibilità con `08`; gli altri sono obbligatori per eliminare inferenze nei test e nei frame specialistici. Tutti sono JSON deterministici, senza path assoluti e senza codice sorgente.

### 6.4 Layout e frame variants meccanici

Costanti comuni:

```text
canvasWidth = 1600
canvasHeight min = 1000
headerHeight = 96
margin = 40
cardWidth = 280
cardHeight = 120
gapX = 32
gapY = 32
fontFamily = system-ui, sans-serif
labelMaxChars = 42
labelTruncationSuffix = …
```

Ordine attributi SVG per elementi creati dal renderer:

```text
id, data-pmem-id, x, y, width, height, rx, ry, class, fill, stroke, stroke-width
```

Frame:

| Frame | Output path | Data set | Sort | Empty state |
|---|---|---|---|---|
| `current` | `.codex/memory/current.svg`, `.codex/memory/current.map.json` | modules + warnings compact | modules id asc; warnings severity desc/path/msg | testo `No indexed modules yet` |
| `overview` | `.codex/memory/frames/overview.svg`, `.codex/memory/frames/overview.map.json` | stesso di current | stesso | stesso |
| `modules` | `.codex/memory/frames/modules.svg`, `.codex/memory/frames/modules.map.json` | modules + dependency edges | modules id asc; edges `fromId,toId,kind` asc | testo `No module dependencies yet` |
| `duplicates` | `.codex/memory/frames/duplicates.svg`, `.codex/memory/frames/duplicates.map.json` | duplicate candidates active/cache | similarity desc; moduleId asc; name asc | testo `No duplicate candidates` |
| `risks` | `.codex/memory/frames/risks.svg`, `.codex/memory/frames/risks.map.json` | critical warnings + criticalRules | severity critical > warning > info; moduleId/path/msg asc | testo `No active risks` |

Map id grammar resta quello di `08`:

```text
module:<moduleId>
file:<relative-posix-path>
symbol:<fqName>
route:<METHOD>:<path>
warning:<warningId>
duplicate:<candidateId>
```

### 6.5 PNG policy

- SVG e map JSON sono obbligatori.
- PNG è nullable.
- Se `sharp` manca, fallisce o `render.png=false`, `png=null` e warning transiente/persistente `png_export_failed` secondo `16`.
- `frame current` e `memory.frame` non considerano PNG mancante un errore.

### 6.6 Snapshot lifecycle

Implementare il lifecycle di `16`:

- `pmem index` e `pmem refresh` iniziano un ciclo snapshot: `latest` esistente viene copiato/renominato a `previous` prima delle mutazioni DB.
- Al successo scrivono `latest.snapshot.json` con lo stato DB corrente.
- `pmem render` non ruota snapshot; aggiorna `latest` in place se esiste, o lo crea se manca.
- `pmem diff` non scrive snapshot.

### 6.7 Acceptance pass 4

- Due render consecutivi su DB invariato producono stesso `sourceHash` e stesso SVG byte-for-byte.
- `current.svg` e `current.map.json` esistono sempre dopo render riuscito.
- PNG fallito produce `png=null`, non errore.
- Ogni item visibile SVG ha `data-pmem-id` presente in map.
- `pmem frame current --json` non renderizza implicitamente.
- `pmem diff --json` è compatto e senza side effect.

---

## 7. Pass 5 — P5, micro-agent rule-based

### 7.1 Leggere prima

```text
01: P5
04: P5 scoring/duplicates contracts
05: retrieval_logs, duplicate_candidates
06: query/duplicates
09: agent contracts
16: agent schemas, warning/error catalog
17: golden query/duplicates
```

### 7.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `src/store/retrieval-log-repository.ts` | create | `insertRetrievalLog`, `addRetrievalLog`, `listRecentRetrievalLogs` |
| `src/store/duplicate-repository.ts` | create | `replaceDuplicateCandidates`, `listDuplicateCandidates` |
| `src/agents/tokenize.ts` | create | `tokenizeForSearch`, `tokenizeForDuplicate`, `normalizeArtifactNameForDuplicate` |
| `src/agents/dispatcher.ts` | create | `dispatchAgent` |
| `src/agents/retrieval-agent.ts` | create | `runRetrievalAgent`, `scoreRetrievalCandidates` |
| `src/agents/duplicate-agent.ts` | create | `runDuplicateAgent`, `scoreDuplicateRisk` |
| `src/agents/drift-agent.ts` | create | `runDriftAgent` |
| `src/agents/architecture-agent.ts` | create | `runArchitectureAgent` |
| `src/agents/render-agent.ts` | create | `runRenderAgent` |
| `src/cli/commands/query.ts` | create | `cmdQuery` |
| `src/cli/commands/duplicates.ts` | create | `cmdDuplicates` |
| `src/cli/commands/refresh.ts` | create | `cmdRefresh` |
| `src/cli/pmem.ts` | update | register `query`, `duplicates`, `refresh` |
| `test/agents/tokenize.test.ts` | create | n/a |
| `test/agents/retrieval-agent.test.ts` | create | n/a |
| `test/agents/duplicate-agent.test.ts` | create | n/a |
| `test/agents/dispatcher.test.ts` | create | n/a |
| `test/cli/query-duplicates-refresh.test.ts` | create | n/a |

### 7.3 Risoluzioni nominali obbligatorie

Per eliminare conflitti residui:

- Repository retrieval log deve esportare **entrambi** `insertRetrievalLog` e `addRetrievalLog`; `addRetrievalLog` può delegare a `insertRetrievalLog`.
- Repository duplicate deve esportare `replaceDuplicateCandidates` e `listDuplicateCandidates`.
- Tie-break retrieval canonico: `score desc -> non-generated first -> non-test first -> path asc -> fqName asc -> id asc`.
- Tokenizzazione retrieval rimuove token con lunghezza `< 2`.
- Output CLI/MCP usa gli schema di `16`, non esempi divergenti.

### 7.4 Acceptance pass 5

- `pmem query ... --json` restituisce `ContextPack` compatto con limiti rispettati.
- `pmem duplicates --kind service --module access --name AccessValidationService ... --json` restituisce high risk sulla fixture.
- `refresh` default changed-only e render true.
- Retrieval/duplicate logs non contengono codice sorgente o path assoluti.
- High duplicate non può restituire `create_new_artifact`.

---

## 8. Pass 6 — P6, MCP server e tool

### 8.1 Leggere prima

```text
01: P6
04: P6 MCP contracts
07: MCP tool contracts
16: MCP schemas
17: golden MCP sequence
```

### 8.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `src/mcp/server.ts` | create | `createMcpServer`, `runMcpServer` |
| `src/mcp/schemas.ts` | create | `getMemoryToolSchemas`, schema exports matching `16` |
| `src/mcp/errors.ts` | create | `toMcpToolError` |
| `src/mcp/tools/head.ts` | create | `handleMemoryHead` |
| `src/mcp/tools/query.ts` | create | `handleMemoryQuery` |
| `src/mcp/tools/duplicates.ts` | create | `handleMemoryDuplicates` |
| `src/mcp/tools/frame.ts` | create | `handleMemoryFrame` |
| `src/mcp/tools/refresh.ts` | create | `handleMemoryRefresh` |
| `src/mcp/tools/diff.ts` | create | `handleMemoryDiff` |
| `test/mcp/server.test.ts` | create | n/a |
| `test/mcp/schemas.test.ts` | create | n/a |
| `test/mcp/tools-head.test.ts` | create | n/a |
| `test/mcp/tools-query.test.ts` | create | n/a |
| `test/mcp/tools-duplicates.test.ts` | create | n/a |
| `test/mcp/tools-frame-refresh-diff.test.ts` | create | n/a |

### 8.3 Tool list chiusa

Il server espone solo:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

Vietati in v0.1: `memory.searchCode`, `memory.sql`, `memory.dump`, `memory.embeddings`, `memory.feature`, `memory.write`, `memory.patch`.

### 8.4 Acceptance pass 6

- Output MCP non usa wrapper `CliResult`.
- Errori MCP usano solo `ErrorPayload` canonico.
- `memory.head` funziona prima di init.
- `memory.frame` non renderizza implicitamente.
- `memory.refresh` propaga PNG warning come warning, non errore.
- Tool list contiene esattamente sei tool.

---

## 9. Pass 7 — P7 + P8, supported lifecycle e subagent templates

### 9.1 Leggere prima

```text
01: P7, P8
04: P7, P8
09: agent/lifecycle contracts
15: skill lifecycle/agent static templates
16: MCP, skill/plugin schemas
17: MCP/demo fixtures
```

### 9.2 File da creare o aggiornare

| File | Azione | Export pubblico ammesso |
|---|---|---|
| `skills/repo-memory/SKILL.md` | update | n/a |
| `skills/repo-memory/agents/openai.yaml` | update | n/a |
| `src/agents/templates.ts` | create | `renderAgentTemplate`, `listAgentTemplates`, `installAgentTemplates` |
| `templates/agents/pmem-retriever.toml` | create | n/a | exact content from `15` |
| `templates/agents/pmem-duplicate-checker.toml` | create | n/a | exact content from `15` |
| `templates/agents/pmem-architecture-reviewer.toml` | create | n/a | exact content from `15` |
| `src/cli/commands/agents.ts` | create | `cmdAgentsInstall`, `cmdAgentsList` |
| `src/cli/pmem.ts` | update | register `agents install`, `agents list` |
| `test/agents/templates.test.ts` | create | n/a |
| `test/cli/agents.test.ts` | create | n/a |

### 9.3 Lifecycle mapping obbligatorio

```text
Prompt start -> memory.head
Implementation intent -> memory.query
New artifact intent -> memory.duplicates
After source changes -> memory.refresh changedOnly=true render=true
Visual orientation -> memory.frame
Review/closeout -> memory.diff
```

### 9.4 Acceptance pass 7

- `skills/repo-memory/agents/openai.yaml` contiene `allow_implicit_invocation: true`.
- Agent YAML dichiara esattamente i sei tool MCP v0.1 come dipendenze.
- `SKILL.md` documenta il lifecycle supportato e non richiede hook plugin.
- Subagenti TOML sono read-only e MCP-first.
- `pmem agents install --scope project --json` non sovrascrive senza force.

---

## 10. Pass 8 — P9, test finale e demo

### 10.1 Leggere prima

```text
01: P9
10: acceptance finale
12: demo scenario
17: fixture/golden authoritative
16: public schemas for all assertions
```

### 10.2 File da creare o aggiornare

| File | Azione | Note |
|---|---|---|
| `test/fixtures/nest-basic/**` | verify/update | deve corrispondere a `17` |
| `test/e2e/fixture-nest-basic.test.ts` | create | init -> scan -> index -> render -> query -> duplicates -> refresh -> diff |
| `test/e2e/no-absolute-paths.test.ts` | create | controlla CLI/MCP/generated/map/snapshot |
| `test/e2e/png-nullable.test.ts` | create | simula `sharp` mancante/failure |
| `test/e2e/changed-delete-cascade.test.ts` | create | modifica e delete file |
| `test/e2e/mcp-sequence.test.ts` | create | head/query/duplicates/frame/refresh/diff |
| `scripts/demo-nest-basic.mjs` | create | script demo opzionale, non gate se test e2e coprono |
| `README.md` | update | aggiungere walkthrough demo breve |

### 10.3 Acceptance finale

La v0.1 è completa solo se:

- tutti gli output JSON pubblici validano contro `16`;
- tutti i golden minimi di `17` passano;
- `current.svg` e `current.map.json` sono obbligatori e presenti;
- PNG può essere `null` con warning;
- duplicate guard blocca `AccessValidationService` come high risk;
- refresh changed-only non reindicizza tutto se non necessario;
- diff non scrive snapshot e non contiene codice sorgente;
- lifecycle skill/MCP è validato;
- nessun path assoluto compare in DB JSON columns, generated JSON, CLI, MCP, map o snapshot.

---

## 11. File vietati senza aggiornamento documentale

Un agente non deve creare questi file o concetti in v0.1:

```text
src/vector/**
src/embeddings/**
src/dashboard/**
src/cloud/**
src/github/**
src/refactor/**
src/llm/**
features table
source_chunks table
vector table
memory.write MCP tool
memory.sql MCP tool
pmem embeddings command
pmem cloud command
pmem validate command
```

Eccezione: test negativi possono contenere stringhe di questi nomi per verificare che non vengano generati.
