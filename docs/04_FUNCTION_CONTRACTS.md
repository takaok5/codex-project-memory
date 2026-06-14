# Codex Project Memory Plugin — contratti moduli e funzioni v0.1

**Stato:** contratto funzioni/tipi raffinato global-pass5 autonomous-ready, allineato a data model, CLI, MCP, renderer, agenti/hook e test.  
**Scopo:** impedire a Codex di inventare contratti durante l’implementazione. Ogni modulo, funzione pubblica, tipo condiviso, side effect e boundary di errore deve rispettare questo documento.  
**Autorità:** `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` resta la fonte operativa primaria. Questo file vincola la forma implementativa delle funzioni. Se una funzione non è qui, Codex non deve implementarla senza aggiornare prima questo documento.

---

## 0. Decisioni vincolanti consolidate

1. `toErrorPayload()` restituisce solo `ErrorPayload`, non `{ ok:false, error }`.
2. `PmemErrorCode` diventa enum unico condiviso da CLI, MCP, hook e agenti.
3. P1 viene contrattualizzata: manifest plugin, MCP config, skill skeleton, hook config e asset placeholder.
4. I path vengono separati in tre funzioni: normalizzazione separatori, path relativo al progetto, path relativo alla memory root.
5. Le scritture JSON/SVG/map usano atomic write: temp file + rename.
6. File cancellati in changed-only v0.1 vengono rimossi con hard delete cascade, non marcati soft-delete.
7. Import non risolti non vengono salvati come `symbol_edges`: diventano warning `unresolved_import`.
8. I warning non sono append-only illimitati: il re-index usa `replaceWarningsForFile()` per evitare duplicati.
9. I test link vengono rimpiazzati per file con `replaceTestLinksForFile()`, non upsert generico non vincolato.
10. `features` resta fuori dal core path v0.1: nessuna funzione obbligatoria lo popola.
11. PNG è best-effort: SVG e map JSON sono obbligatori; PNG può essere `null` con warning.
12. `symbol_edges` contiene solo edge risolti con `fromSymbolId` e `toSymbolId` not null; import non risolti diventano warning.
13. Hook `Stop` usa loop guard esplicito via env + lock file.
14. Agent scoring e duplicate thresholds sono deterministici e documentati.

---

## 1. Regole generali

- La v0.1 è TypeScript/JavaScript, Node.js 20+, SQLite locale, SVG deterministico, PNG fallback.
- Nessuna funzione v0.1 modifica codice sorgente del repository target.
- Nessuna funzione richiede backend cloud, embeddings, vector DB o LLM nella core path.
- Subagenti Codex sono opzionali e read-only dove previsto; i micro-agent runtime sono rule-based.
- Tutti i path persistiti in DB e JSON devono essere relativi POSIX.
- Tutti i path assoluti possono vivere solo in runtime memory, mai in DB, generated JSON, MCP output o CLI JSON output.
- Ogni funzione con side effect deve avere test unit/integration mirato.
- Ogni input esterno deve essere validato con Zod o validatore equivalente locale.
- Gli output di CLI `--json`, MCP e hook devono essere JSON compatti senza prose libere.
- `better-sqlite3` può essere sync; funzioni con filesystem async, MCP, hooks e PNG export devono essere async.
- Un errore su singolo file non deve bloccare un index completo: genera warning e il run continua, salvo errore DB/config/fs fatale.

---

## 2. Tipi canonici condivisi

Questi tipi devono vivere in `src/shared/types.ts`, salvo tipi strettamente locali. I moduli possono esportare alias più specifici, ma non cambiare shape semantica.

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject { [key: string]: JsonValue }

type MemoryStatus = "not_initialized" | "initializing" | "fresh" | "stale" | "dirty" | "error";
type MemoryEvent = "init_started" | "init_completed" | "index_started" | "index_completed" | "render_completed" | "mark_dirty" | "mark_error" | "doctor_ok";

type LanguageKind = "typescript" | "javascript";

type ArtifactKind =
  | "service"
  | "controller"
  | "dto"
  | "type"
  | "interface"
  | "enum"
  | "repository"
  | "utility"
  | "route"
  | "migration"
  | "table"
  | "job"
  | "adapter"
  | "module"
  | "feature";

type WarningSeverity = "info" | "warning" | "critical";
type WarningSource = "parser" | "indexer" | "renderer" | "agent" | "hook" | "mcp" | "config" | "inferred";
type RiskLevel = "low" | "medium" | "high";
type DuplicateVerdict = "create_new_artifact" | "extend_existing_artifact" | "needs_human_review";
type FrameName = "current" | "overview" | "modules" | "duplicates" | "risks";
type FrameType = "current" | "overview" | "module_map" | "duplicate_map" | "risk_map";
type AgentName = "retrieval" | "duplicate" | "drift" | "architecture" | "render";

type PmemErrorCode =
  | "INVALID_INPUT"
  | "VALIDATION_ERROR"
  | "NOT_INITIALIZED"
  | "ALREADY_EXISTS"
  | "CONFIG_ERROR"
  | "FS_ERROR"
  | "DB_ERROR"
  | "INDEX_ERROR"
  | "RENDER_ERROR"
  | "AGENT_ERROR"
  | "MCP_ERROR"
  | "HOOK_ERROR"
  | "SAFETY_ERROR"
  | "STATE_ERROR"
  | "FRAME_NOT_FOUND"
  | "TEMPLATE_ERROR"
  | "INTERNAL_ERROR";

interface ErrorPayload {
  code: PmemErrorCode;
  message: string;
  recoverable: boolean;
  details?: JsonObject;
}

interface CliResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
  warnings?: string[];
}

interface CommonCliOptions { json: boolean; cwd: string; verbose: boolean }
interface CliOutputOptions { json: boolean; verbose?: boolean }

interface PluginManifestOptions {
  packageName: string;
  version: string;
  description?: string;
  mcpConfigPath?: string;
  skillsPath?: string;
  assets?: PluginAssetPaths;
}

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: { name: string; email?: string; url?: string };
  skills: string;
  mcpServers: string;
  keywords: string[];
  interface: {
    displayName: string;
    shortDescription: string;
    longDescription: string;
    developerName: string;
    category: string;
    capabilities: string[];
    defaultPrompt: string[];
    brandColor: string;
    composerIcon?: string;
    logo?: string;
  };
}

interface McpConfigOptions { serverName: "project-memory"; command: string; args: string[] }
interface McpConfig { mcpServers: Record<string, { command: string; args: string[] }> }
interface SkillDocOptions { pluginName: string; cliCommand: "pmem"; mcpServerName: "project-memory" }
interface HooksConfigOptions { pluginRootVar?: "${PLUGIN_ROOT}" }
interface HooksConfig { hooks: JsonObject }
interface PluginAssetPaths { iconPng: string; logoPng: string }
interface PluginArtifactValidationResult { ok: boolean; missing: string[]; warnings: string[] }
interface ResolveContextOptions { cwd?: string; allowMissingConfig?: boolean; openDb?: boolean }

interface McpServerOptions { cwd?: string }
interface MemoryToolSchemas { tools: JsonObject[] }
interface SnapshotOptions { write?: boolean; label?: string; includeFrames?: boolean }
type SnapshotRef = "previous" | "latest" | "current" | string;
interface MemorySnapshot { version: 1; createdAt: string; files: JsonObject[]; symbols: JsonObject[]; warnings: JsonObject[]; frames: JsonObject[] }
interface MemoryDiff { changedFiles: string[]; changedModules: string[]; addedSymbols: string[]; removedSymbols: string[]; newWarnings: string[]; resolvedWarnings: string[]; warnings: string[] }

type AgentTemplateName = "pmem-retriever" | "pmem-duplicate-checker" | "pmem-architecture-reviewer";
interface AgentTemplateVars { projectName?: string; mcpServerName: "project-memory" }
interface AgentTemplateDescriptor { name: AgentTemplateName; targetFile: string; description: string }
```

### 2.1 Runtime/config types

```ts
interface MemoryPaths {
  projectRootAbs: string;
  memoryRootAbs: string;
  memoryRootRel: ".codex/memory";
  configAbs: string;
  configRel: ".codex/memory/project-memory.config.json";
  dbAbs: string;
  dbRel: ".codex/memory/memory.db";
  currentSvgAbs: string;
  currentSvgRel: ".codex/memory/current.svg";
  currentPngAbs: string;
  currentPngRel: ".codex/memory/current.png";
  currentMapAbs: string;
  currentMapRel: ".codex/memory/current.map.json";
  framesDirAbs: string;
  framesDirRel: ".codex/memory/frames";
  generatedDirAbs: string;
  generatedDirRel: ".codex/memory/generated";
  snapshotsDirAbs: string;
  snapshotsDirRel: ".codex/memory/snapshots";
  cacheDirAbs: string;
  cacheDirRel: ".codex/memory/cache";
  logsDirAbs: string;
  logsDirRel: ".codex/memory/logs";
}

interface ProjectMemoryConfig {
  schemaVersion: 1;
  projectName: string;
  scan: {
    include: string[];
    exclude: string[];
    languages: LanguageKind[];
    maxFileBytes: number;
  };
  modules: Array<{
    id: string;
    name: string;
    rootPath?: string;
    owns?: string[];
    mustNot?: string[];
    dependencies?: string[];
    riskLevel?: "normal" | "high";
  }>;
  criticalRules: string[];
  render: {
    png: boolean;
    maxModules: number;
    maxWarnings: number;
  };
  agents: {
    maxFiles: number;
    maxSymbols: number;
    maxWarnings: number;
  };
  hooks: {
    enabled: boolean;
    autoRefreshOnStop: boolean;
    maxChangedFilesForStopRefresh: number;
  };
}

interface RuntimeContext {
  projectRoot: string;
  memoryPaths: MemoryPaths;
  config: ProjectMemoryConfig;
  db?: Database;
}

interface ProjectRootResult {
  root: string;
  method: "git" | "cwd";
  warnings: string[];
}

interface ProjectState {
  schemaVersion: string | null;
  status: MemoryStatus;
  projectName: string | null;
  lastIndexedAt: string | null;
  lastRenderedAt: string | null;
  memoryDirty: boolean;
  dirtyReason: string;
  lastError: ErrorPayload | null;
}
```

### 2.2 Store record types

```ts
interface IndexedFileRecord {
  id?: number;
  path: string;
  language: LanguageKind | null;
  moduleId: string | null;
  hash: string;
  sizeBytes: number;
  lineCount: number;
  isTest: boolean;
  isGenerated: boolean;
  lastIndexedAt: string;
}

interface SymbolRecord {
  id?: number;
  fileId: number;
  fqName: string;
  name: string;
  kind: ArtifactKind | "class" | "function" | "method" | "const" | "provider";
  exported: boolean;
  startLine?: number;
  endLine?: number;
  signature?: string;
  signatureHash?: string;
  bodyHash?: string;
  summary?: string;
}

interface ImportExportEdgeInput {
  fromFileId?: number;
  fromSymbolName?: string;
  importedName: string;
  sourceModule: string;
  edgeKind: "import" | "export" | "dependency";
  resolved: boolean;
}

interface ResolvedSymbolEdgeInput {
  fromSymbolId: number;
  toSymbolId: number;
  edgeKind: "import" | "export" | "dependency";
  confidence: number;
}

interface SymbolEdgeRecord extends ResolvedSymbolEdgeInput {
  id?: number;
  sourceFileId: number;
}

interface ModuleRecord {
  id: string;
  name: string;
  rootPath?: string;
  summary?: string;
  owns: string[];
  mustNot: string[];
  dependencies: string[];
  riskLevel: "normal" | "high";
  updatedAt: string;
}

interface RouteRecordInput {
  method: string;
  path: string;
  handlerSymbolId?: number;
  moduleId?: string;
}

interface RouteRecord extends RouteRecordInput {
  id?: number;
  fileId: number;
}

interface TestLinkRecord {
  fileId: number;
  targetSymbolId?: number;
  testKind: "unit" | "integration" | "e2e" | "unknown";
  summary?: string;
}

interface WarningRecordInput {
  warningType: string;
  severity: WarningSeverity;
  moduleId?: string;
  fileId?: number;
  symbolId?: number;
  message: string;
  recommendation?: string;
  source: WarningSource;
  confidence: number;
}

interface WarningRecord extends WarningRecordInput {
  id: number;
  createdAt: string;
  resolvedAt?: string | null;
}

interface FrameRecord {
  id: FrameName;
  frameType: FrameType;
  title: string;
  svgPath: string;
  pngPath: string | null;
  mapPath: string;
  sourceHash: string;
  generatedAt: string;
}
```

### 2.3 Agent/MCP/hook types

```ts
interface AgentContext extends RuntimeContext {
  db: Database;
}

interface RetrievalAgentInput {
  intent: string;
  maxFiles: number;
  maxSymbols: number;
  maxWarnings: number;
  includeVisualFrame: boolean;
}

interface ContextPack {
  summary: string;
  modules: ContextModule[];
  files: ContextFile[];
  symbols: ContextSymbol[];
  constraints: string[];
  warnings: ContextWarning[];
  nextCommands: string[];
  visualFrame?: FrameRef;
}

interface ContextModule { id: string; name: string; reason: string; score: number }
interface ContextFile { path: string; moduleId?: string; reason: string; score: number; isTest?: boolean }
interface ContextSymbol { fqName: string; kind: string; filePath: string; reason: string; score: number }
interface ContextWarning { severity: WarningSeverity; message: string; filePath?: string; recommendation?: string }
interface FrameRef { frame: FrameName; svg: string; png: string | null; map: string }

interface RetrievalAgentOutput {
  intent: string;
  contextPack: ContextPack;
}

interface DuplicateAgentInput {
  kind: ArtifactKind;
  intent: string;
  moduleId?: string;
  proposedName?: string;
}

interface DuplicateCandidate {
  kind: ArtifactKind;
  symbolId?: number;
  fileId?: number;
  name: string;
  fqName?: string;
  filePath?: string;
  moduleId?: string;
  similarity: number;
  reason: string;
}

interface DuplicateAgentOutput {
  risk: RiskLevel;
  verdict: DuplicateVerdict;
  matches: DuplicateCandidate[];
  recommendation: string;
}

interface McpToolEnv {
  cwd: string;
  now?: () => string;
}

interface HookInputResult {
  event: unknown;
  warnings: string[];
}

interface HookOutput {
  ok: true;
  action: "noop" | "additional_context" | "marked_dirty" | "refreshed" | "logged";
  additionalContext?: string;
  warnings: string[];
}

// Phase-local public types. These shapes are required because function tables below
// reference them; Codex must not invent alternate shapes. Private helper types are allowed
// only inside the owning module.
interface ScannedFile {
  path: string;
  absPath: string;
  language: LanguageKind | null;
  sizeBytes: number;
  hash: string;
  isTest: boolean;
  isGenerated: boolean;
}

interface FileFilter { moduleId?: string; language?: LanguageKind; isTest?: boolean; limit?: number }
interface SymbolSearchQuery { query?: string; moduleId?: string; filePath?: string; kind?: string; limit?: number }

interface AstIndexOptions { fileId: number; moduleId: string | null }
interface AstIndexResult {
  file: IndexedFileRecord;
  symbols: SymbolRecord[];
  imports: ImportExportEdgeInput[];
  routes: RouteRecordInput[];
  testLinks: TestLinkRecord[];
  warnings: WarningRecordInput[];
}

interface IndexOptions { changedOnly?: boolean; render?: boolean; reason?: string }
interface IndexResult {
  scannedFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  deletedFiles: number;
  warningCount: number;
  status: MemoryStatus;
}

interface GraphBuildOptions { frame?: FrameName; maxModules?: number; maxWarnings?: number }
interface NormalizedGraph {
  version: 1;
  project: { name: string; status: MemoryStatus; generatedAt?: string };
  modules: JsonObject[];
  files: JsonObject[];
  symbols: JsonObject[];
  routes: JsonObject[];
  warnings: JsonObject[];
  duplicateCandidates: JsonObject[];
  edges: JsonObject[];
  criticalRules: string[];
}
interface GraphNodeLayout { id: string; kind: string; label: string; x: number; y: number; width: number; height: number; path?: string }
interface GraphEdgeLayout { id: string; from: string; to: string; kind: string }
interface LayoutResult { frame: FrameName; width: number; height: number; nodes: GraphNodeLayout[]; edges: GraphEdgeLayout[]; warnings: string[] }
interface LayoutOptions { frame?: FrameName; width?: number; columnWidth?: number; rowHeight?: number }
interface FrameMapItem { id: string; kind: string; label: string; bbox: { x: number; y: number; width: number; height: number }; paths: string[]; symbols?: string[]; commands: string[] }
interface FrameMap { version: 1; frame: FrameName; svg: string; png: string | null; sourceHash: string; items: FrameMapItem[] }
interface GeneratedJsonResult { paths: string[]; hashes: Record<string, string> }
interface RenderOptions { frame?: FrameName; png?: boolean; writeSnapshot?: boolean }
interface PngExportResult { ok: boolean; path?: string; warning?: string }

interface RetrievalCandidate { kind: "module" | "file" | "symbol" | "route" | "warning"; id: string; path?: string; name?: string; moduleId?: string; raw: JsonObject }
interface ScoredRetrievalCandidate extends RetrievalCandidate { score: number; reason: string }
interface DuplicateRiskScore { risk: RiskLevel; verdict: DuplicateVerdict; similarity: number; reason: string }
interface RetrievalLogInput { intent: string; outputJson: JsonObject; createdAt: string }
interface DuplicateCandidateRecord { leftFileId?: number; rightFileId?: number; leftSymbolId?: number; rightSymbolId?: number; kind: ArtifactKind; similarity: number; reason: string }

interface DriftAgentInput { reason?: string }
interface DriftAgentOutput { status: MemoryStatus; warnings: string[]; nextCommands: string[] }
interface ArchitectureAgentInput { intent: string; contextPack?: ContextPack }
interface ArchitectureAgentOutput { constraints: string[]; warnings: string[]; recommendations: string[] }
interface RenderAgentInput { frame?: FrameName; png?: boolean }
interface RenderAgentOutput { frame: FrameRef; warnings: string[] }

type AgentInput<N extends AgentName> =
  N extends "retrieval" ? RetrievalAgentInput :
  N extends "duplicate" ? DuplicateAgentInput :
  N extends "drift" ? DriftAgentInput :
  N extends "architecture" ? ArchitectureAgentInput :
  N extends "render" ? RenderAgentInput :
  never;

type AgentOutput<N extends AgentName> =
  N extends "retrieval" ? RetrievalAgentOutput :
  N extends "duplicate" ? DuplicateAgentOutput :
  N extends "drift" ? DriftAgentOutput :
  N extends "architecture" ? ArchitectureAgentOutput :
  N extends "render" ? RenderAgentOutput :
  never;
```

---

### 2.4 Tipi posseduti da contratti specialistici

Alcuni nomi compaiono nelle signature di `04` ma la loro shape completa è posseduta dal contratto specialistico per evitare duplicazione. Un agente deve leggerli lì e non inventarli:

| Tipo/famiglia | Fonte autoritativa | Regola |
|---|---|---|
| `InitOptions`, `InitOutput`, `DoctorOutput`, `RenderOutput`, ecc. | `06_CLI_CONTRACTS.md` | shape CLI pubblica e opzioni comando |
| `MemoryHeadOutput`, `MemoryQueryOutput`, `MemoryRefreshOutput`, ecc. | `07_MCP_TOOL_CONTRACTS.md` | shape MCP pubblica |
| `FrameMap`, `NormalizedGraph`, layout dettagliato | `08_RENDERER_VISUAL_CONTRACT.md` | `04` dà minimo, `08` dà schema renderer completo |
| hook event payload raw | `09_AGENTS_AND_HOOKS_CONTRACT.md` | input esterno resta `unknown`, output è `HookOutput` |
| fixture/demo expected outputs | `12_DEMO_SCENARIO.md` | dati concreti per test E2E |
| `Database` | `better-sqlite3` | non esportare da `shared`; import locale in `store`/moduli che aprono DB |
| `SourceFile` | `ts-morph` | import locale in indexer |
| `McpServer` | `@modelcontextprotocol/sdk` | import locale in `src/mcp/server.ts` |

Regola per agente stupido: se un tipo in signature non è definito in `04`, cercarlo nella fonte autoritativa di questa tabella. Se non esiste nemmeno lì, aggiornare la documentazione prima di implementare API pubblica.

---

## 3. Boundary rules tra moduli

| Modulo | Può importare | Non può importare |
|---|---|---|
| `shared` | nessun modulo interno | runtime/store/indexer/renderer/agents/cli/mcp/hooks |
| `runtime` | `shared` | cli/mcp/hooks |
| `store` | `shared`, tipi runtime | cli/mcp/hooks/renderer |
| `indexer` | `shared`, `runtime`, `store` | cli/mcp/hooks |
| `renderer` | `shared`, `runtime`, `store` | cli/mcp/hooks |
| `agents` | `shared`, `runtime`, `store`, `renderer` solo per render-agent | cli/mcp/hooks |
| `cli` | moduli pubblici runtime/store/indexer/renderer/agents | mcp protocol internals |
| `mcp` | runtime/agents/renderer/shared | cli console output |
| `hooks` | runtime/store/agents/shared o command wrappers dedicati | MCP server internals |

Invarianti:

- `shared` non deve dipendere da `better-sqlite3`.
- `mcp` non deve usare `printResult()`.
- `hooks` non devono scrivere testo libero su stdout.
- `agents` non devono invocare subagenti Codex.

---

## 4. Error boundary contract

| Boundary | Forma successo | Forma errore | Regola |
|---|---|---|---|
| Funzioni interne | valore typed | throw `PmemError` | niente JSON wrapper interno salvo repository/log |
| CLI command handlers | `CliResult<T>` | `CliResult` con `error` | `runCli()` converte in exit code |
| CLI stdout `--json` | JSON compatto | JSON compatto | nessuna prosa |
| MCP handlers | output typed | throw `PmemError` | solo `server.ts` mappa su error payload MCP |
| Hook runner | `HookOutput` | `HookOutput` no-op con warning | hook non rompe protocollo |
| Micro-agent dispatcher | `AgentOutput<N>` | throw `PmemError("AGENT_ERROR")` o validation | output validato |

### 4.1 Recoverability default

| Code | Recoverable default |
|---|---|
| `INVALID_INPUT`, `VALIDATION_ERROR`, `NOT_INITIALIZED`, `ALREADY_EXISTS`, `CONFIG_ERROR`, `FS_ERROR`, `INDEX_ERROR`, `RENDER_ERROR`, `AGENT_ERROR`, `MCP_ERROR`, `HOOK_ERROR`, `STATE_ERROR`, `FRAME_NOT_FOUND`, `TEMPLATE_ERROR` | `true` |
| `DB_ERROR`, `SAFETY_ERROR`, `INTERNAL_ERROR` | `false` salvo dettagli espliciti |

---

## 5. Filesystem/path/atomic write contracts

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/shared/path.ts` | `normalizePathSeparators` | `function normalizePathSeparators(path: string): string` | path qualsiasi | path con `/` | none | non rende relativo da solo | empty -> empty | win/unix |
| `src/shared/path.ts` | `toProjectRelativePosix` | `function toProjectRelativePosix(absPath: string, projectRoot: string): string` | path assoluto + root | path relativo POSIX | none | deve restare dentro root | fuori root -> `SAFETY_ERROR` | root/escape cases |
| `src/shared/path.ts` | `toMemoryRelativePosix` | `function toMemoryRelativePosix(absPath: string, paths: MemoryPaths): string` | path assoluto + paths | path relativo `.codex/memory/...` | none | deve restare dentro memory root | fuori memory -> `SAFETY_ERROR` | frame paths |
| `src/shared/fs-safety.ts` | `assertInsideProjectRoot` | `function assertInsideProjectRoot(absPath: string, projectRoot: string): void` | abs path + root | void | none | blocca path traversal | `SAFETY_ERROR` | outside root |
| `src/shared/fs-safety.ts` | `assertInsideMemoryRoot` | `function assertInsideMemoryRoot(absPath: string, paths: MemoryPaths): void` | abs path + memory paths | void | none | ogni write memory passa da qui | `SAFETY_ERROR` | outside memory |
| `src/shared/fs.ts` | `ensureParentDirectory` | `function ensureParentDirectory(path: string): void` | target file path | void | crea directory parent | idempotente | `FS_ERROR` | missing parent |
| `src/shared/fs.ts` | `writeFileAtomic` | `function writeFileAtomic(path: string, content: string | Buffer): void` | target + content | void | temp write + rename | mai lascia file parziale finale | `FS_ERROR`; temp cleanup best-effort | simulated failure |
| `src/shared/json.ts` | `writeJsonFileAtomic` | `function writeJsonFileAtomic(path: string, value: unknown): void` | path + serializable value | void | scrive JSON compatto atomico | validazione serializzazione prima del rename | `INTERNAL_ERROR` circular; `FS_ERROR` write | circular/write |

---

## P0 — scaffold, shared, CLI base

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/shared/version.ts` | `VERSION` | `export const VERSION: string` | n/a | semantic version string | none | match package.json major/minor per v0.1 | none | unit: non-empty |
| `src/shared/errors.ts` | `PmemError` | `class PmemError extends Error { code: PmemErrorCode; recoverable: boolean; details?: JsonObject }` | code/message/details | typed error | none | message non vuoto; code enum | invalid code compile-time impossible | unit: preserves fields |
| `src/shared/errors.ts` | `toErrorPayload` | `function toErrorPayload(error: unknown): ErrorPayload` | unknown | `ErrorPayload` | none | never throws; redacts stack/path assoluti | unknown -> `INTERNAL_ERROR` | unit: Error/string/PmemError |
| `src/shared/json.ts` | `safeJsonParse` | `function safeJsonParse<T>(text: string): { ok: true; value: T } \| { ok: false; error: string }` | raw JSON | discriminated result | none | never throws | invalid -> ok false | unit |
| `src/shared/json.ts` | `writeJson` | `function writeJson(value: unknown): string` | serializable value | compact JSON string | none | no trailing prose, stable property order when caller passes canonical object | circular -> `INTERNAL_ERROR` | compact/circular |
| `src/shared/time.ts` | `nowIso` | `function nowIso(): string` | none | ISO UTC | none | all timestamps persisted use this | none | Date.parse |
| `src/cli/options.ts` | `parseCommonOptions` | `function parseCommonOptions(argv: string[]): CommonCliOptions` | argv | `{ json:boolean; cwd:string; verbose:boolean }` | none | common options for all commands | invalid handled by commander | unit |
| `src/cli/output.ts` | `printResult` | `function printResult(result: CliResult, options: CliOutputOptions): void` | result/options | void | stdout/stderr | `--json` emits only JSON; errors stderr only in human mode | serialization fallback safe JSON | json/human |
| `src/cli/pmem.ts` | `runCli` | `async function runCli(argv: string[], cwd?: string): Promise<number>` | argv/cwd | exit code | calls handlers | no `process.exit` in tests | command errors -> code 1/2 | help/version |

---

## P1 — plugin artifact contracts

P1 produce artifact statici del plugin. Anche se alcuni sono file JSON/TOML/YAML/MD e non runtime code, devono avere generatori/validatori testabili per evitare improvvisazione.

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/plugin/manifest.ts` | `buildPluginManifest` | `function buildPluginManifest(options: PluginManifestOptions): PluginManifest` | name/version/bin/mcp/skills/hooks/assets | manifest object | none | path relativi al plugin; no absolute path | `VALIDATION_ERROR` | schema snapshot |
| `src/plugin/manifest.ts` | `validatePluginManifest` | `function validatePluginManifest(value: unknown): PluginManifest` | unknown JSON | manifest typed | none | Zod/schema source of truth | `CONFIG_ERROR` | invalid/missing fields |
| `src/plugin/mcp-config.ts` | `buildMcpConfig` | `function buildMcpConfig(options: McpConfigOptions): McpConfig` | server command/cwd/env | `.mcp.json` object | none | stdio only; command points to dist MCP server | `VALIDATION_ERROR` | snapshot |
| `src/plugin/mcp-config.ts` | `validateMcpConfig` | `function validateMcpConfig(value: unknown): McpConfig` | unknown JSON | typed config | none | no unsupported transport v0.1 | `CONFIG_ERROR` | invalid transport |
| `src/plugin/skill.ts` | `buildRepoMemorySkillDoc` | `function buildRepoMemorySkillDoc(options: SkillDocOptions): string` | plugin commands/tool names | SKILL.md content | none | skill is workflow only; no project memory content | `TEMPLATE_ERROR` | contains MCP workflow |
| `src/plugin/hooks-config.ts` | `buildHooksConfig` | `function buildHooksConfig(options: HooksConfigOptions): HooksConfig` | dist paths | hooks config object | none | hook commands point to build output; trust note in docs | `VALIDATION_ERROR` | all 4 hooks present |
| `src/plugin/assets.ts` | `ensureAssetPlaceholders` | `function ensureAssetPlaceholders(paths: PluginAssetPaths, options?: { force?: boolean }): void` | asset paths | void | writes placeholder icon/logo if missing | never overwrites without force | `FS_ERROR`, `ALREADY_EXISTS` | creates/skips |
| `src/plugin/validate-artifacts.ts` | `validatePluginArtifacts` | `function validatePluginArtifacts(root: string): PluginArtifactValidationResult` | plugin root | validation summary | reads files | P1 gate; no writes | missing/invalid -> recoverable errors | fixture plugin root |

Artifact obbligatori P1:

```text
.codex-plugin/plugin.json
.mcp.json
skills/repo-memory/SKILL.md
skills/repo-memory/agents/openai.yaml
hooks/hooks.json
assets/icon.png
assets/logo.png
```

---

## P2 — runtime, config, SQLite store

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/runtime/project-locator.ts` | `findProjectRoot` | `function findProjectRoot(startDir?: string): ProjectRootResult` | start dir default cwd | root/method/warnings | reads parent dirs | never returns `.codex/memory` as root | unreadable -> `FS_ERROR`; no git -> cwd fallback | git/cwd/nested |
| `src/runtime/project-locator.ts` | `findGitRoot` | `function findGitRoot(startDir: string): string \| null` | start dir | abs git root/null | reads fs | no spawn git v0.1; supports `.git` dir/file | permission warning by caller | .git dir/file |
| `src/runtime/project-locator.ts` | `assertSafeProjectRoot` | `function assertSafeProjectRoot(root: string): void` | abs root | void | none | not filesystem root; not memory root; writable enough for init | `CONFIG_ERROR`/`SAFETY_ERROR` | dangerous roots |
| `src/runtime/memory-paths.ts` | `getMemoryPaths` | `function getMemoryPaths(projectRoot: string): MemoryPaths` | abs project root | paths object | none | all writes under `<root>/.codex/memory` | `CONFIG_ERROR` | exact paths |
| `src/runtime/memory-paths.ts` | `ensureMemoryDirectories` | `function ensureMemoryDirectories(paths: MemoryPaths): void` | paths | void | creates dirs | idempotent; never deletes | `FS_ERROR` | init tree |
| `src/runtime/context.ts` | `resolveRuntimeContext` | `function resolveRuntimeContext(options?: ResolveContextOptions): RuntimeContext` | cwd/allowMissingConfig/openDb | context | may open DB | config/db behavior explicit via options | `NOT_INITIALIZED`, `CONFIG_ERROR`, `DB_ERROR` | non-init/init |
| `src/runtime/config-loader.ts` | `defaultProjectConfig` | `function defaultProjectConfig(projectName?: string): ProjectMemoryConfig` | optional project name | config | none | schemaVersion 1; default hooks safe | none | defaults snapshot |
| `src/runtime/config-loader.ts` | `loadProjectConfig` | `function loadProjectConfig(paths: MemoryPaths, options?: { allowMissing?: boolean }): ProjectMemoryConfig` | paths/options | validated config | reads config | missing allowed only for doctor/head/UserPromptSubmit | invalid -> `CONFIG_ERROR` | missing/invalid/partial |
| `src/runtime/config-loader.ts` | `writeDefaultProjectConfig` | `function writeDefaultProjectConfig(paths: MemoryPaths, options?: { force?: boolean }): ProjectMemoryConfig` | paths/force | written config | writes config atomically | no overwrite unless force | `ALREADY_EXISTS`, `FS_ERROR` | init/force |
| `src/runtime/config-loader.ts` | `validateProjectConfig` | `function validateProjectConfig(value: unknown): ProjectMemoryConfig` | unknown | typed config | none | Zod/schema source of truth | `CONFIG_ERROR` | schema variants |
| `src/runtime/state-machine.ts` | `transitionMemoryState` | `function transitionMemoryState(current: MemoryStatus, event: MemoryEvent): MemoryStatus` | status/event | next status | none | only documented transitions; idempotent allowed for same terminal state | invalid -> `STATE_ERROR` | matrix |
| `src/store/sqlite.ts` | `openMemoryDb` | `function openMemoryDb(paths: MemoryPaths): Database` | paths | db | opens/creates DB | DB path under memory root | `DB_ERROR` | creates db |
| `src/store/sqlite.ts` | `ensureSchema` | `function ensureSchema(db: Database): void` | db | void | creates tables/indices | idempotent; schema_version=1 | SQL -> `DB_ERROR` | all tables |
| `src/store/sqlite.ts` | `withTransaction` | `function withTransaction<T>(db: Database, fn: () => T): T` | db/callback | callback result | begin/commit/rollback | rollback on throw; nested only via better-sqlite3 safe transaction | rethrow | commit/rollback |
| `src/store/project-state-repository.ts` | `getProjectState` | `function getProjectState(db: Database): ProjectState` | db | state | reads DB | missing keys -> defaults | `DB_ERROR` | default/missing |
| `src/store/project-state-repository.ts` | `setProjectStateValue` | `function setProjectStateValue(db: Database, key: string, value: string): void` | db/key/value | void | upsert | key whitelist; updated_at refreshed | `VALIDATION_ERROR`, `DB_ERROR` | upsert |
| `src/store/project-state-repository.ts` | `markMemoryDirty` | `function markMemoryDirty(db: Database, reason: string): void` | db/reason | void | sets `memory_status=dirty`, `memory_dirty=true`, `dirty_reason`, timestamp | dirty recoverable; frames preserved | `DB_ERROR` | dirty flag |
| `src/store/project-state-repository.ts` | `markMemoryFresh` | `function markMemoryFresh(db: Database, indexedAt?: string): void` | db/timestamp | void | sets `memory_status=fresh`, `memory_dirty=false`, `dirty_reason=""`, `last_indexed_at` if provided | only after successful index and required render; does not clear `last_error` unless run succeeded | `DB_ERROR` | fresh state |
| `src/store/project-state-repository.ts` | `markMemoryError` | `function markMemoryError(db: Database, error: ErrorPayload): void` | db/error | void | sets `memory_status=error`, `last_error` compact JSON | preserves dirty flag | `DB_ERROR` | error state |
| `src/store/file-repository.ts` | `upsertFileRecord` | `function upsertFileRecord(db: Database, file: IndexedFileRecord): number` | file record | file id | upsert files | path unique; hash non-empty; relative POSIX | constraint -> `DB_ERROR`/`VALIDATION_ERROR` | insert/update |
| `src/store/file-repository.ts` | `listFiles` | `function listFiles(db: Database, filter?: FileFilter): IndexedFileRecord[]` | filter | files | reads DB | stable order by path | `DB_ERROR` | filters/order |
| `src/store/file-repository.ts` | `getFileByPath` | `function getFileByPath(db: Database, path: string): IndexedFileRecord \| null` | relative path | file/null | reads DB | normalizes before lookup | `DB_ERROR` | lookup |
| `src/store/file-repository.ts` | `removeFileRecordCascade` | `function removeFileRecordCascade(db: Database, path: string): void` | relative path | void | deletes file and dependent rows | v0.1 hard delete; requires FK/cascade or manual delete in transaction | `DB_ERROR`, `VALIDATION_ERROR` | deleted file removes stale symbols/routes/warnings |

---

## P3 — scanner, AST indexer, changed-only

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/store/symbol-repository.ts` | `replaceSymbolsForFile` | `function replaceSymbolsForFile(db: Database, fileId: number, symbols: SymbolRecord[]): void` | db/file/symbols | void | deletes old symbols for file, inserts new | transactional with file index; unique file/fqName/kind | `DB_ERROR` | stale removal |
| `src/store/symbol-repository.ts` | `searchSymbols` | `function searchSymbols(db: Database, query: SymbolSearchQuery): SymbolRecord[]` | query | symbols | reads DB | limit respected; stable order | `DB_ERROR` | filters |
| `src/store/edge-repository.ts` | `replaceEdgesForFile` | `function replaceEdgesForFile(db: Database, fileId: number, edges: ResolvedSymbolEdgeInput[]): void` | file/edges | void | replaces resolved edges connected to file | `edges` must have non-null from/to symbol ids; unresolved imports are warnings, not rows | `DB_ERROR`, `VALIDATION_ERROR` | replace + unresolved warning |
| `src/store/module-repository.ts` | `upsertModule` | `function upsertModule(db: Database, module: ModuleRecord): void` | module | void | upsert modules | id stable from config/path | `DB_ERROR` | insert/update |
| `src/store/module-repository.ts` | `listModules` | `function listModules(db: Database): ModuleRecord[]` | db | modules | reads DB | stable order by id | `DB_ERROR` | order |
| `src/store/route-repository.ts` | `replaceRoutesForFile` | `function replaceRoutesForFile(db: Database, fileId: number, routes: RouteRecordInput[]): void` | file/routes | void | replaces routes for file | only literal NestJS decorators v0.1 | `DB_ERROR` | replacement |
| `src/store/test-repository.ts` | `replaceTestLinksForFile` | `function replaceTestLinksForFile(db: Database, fileId: number, links: TestLinkRecord[]): void` | file/links | void | replaces test links for file | no duplicate links after re-index | `DB_ERROR` | idempotent reindex |
| `src/store/warning-repository.ts` | `replaceWarningsForFile` | `function replaceWarningsForFile(db: Database, fileId: number, source: WarningSource, warnings: WarningRecordInput[]): void` | file/source/warnings | void | resolves/removes previous active warnings for file+source, inserts current | re-index does not duplicate warnings | `DB_ERROR` | duplicate prevention |
| `src/store/warning-repository.ts` | `resolveWarningsForFile` | `function resolveWarningsForFile(db: Database, fileId: number, source?: WarningSource): void` | file/source optional | void | sets resolved_at | only active warnings touched | `DB_ERROR` | resolve |
| `src/store/warning-repository.ts` | `addWarning` | `function addWarning(db: Database, warning: WarningRecordInput): number` | warning | id | inserts warning | for global/run warnings only; not per-file reindex warnings | `DB_ERROR` | insert |
| `src/store/warning-repository.ts` | `listActiveWarnings` | `function listActiveWarnings(db: Database, limit?: number): WarningRecord[]` | limit | warnings | reads DB | resolved_at null; severity stable order | `DB_ERROR` | active only |
| `src/indexer/scan.ts` | `scanProjectFiles` | `async function scanProjectFiles(root: string, config: ProjectMemoryConfig): Promise<ScannedFile[]>` | root/config | scanned files | reads FS | include/exclude honored; `.codex/memory/**` always excluded; stable sort | glob/fs -> recoverable `FS_ERROR` if partial possible | fixture |
| `src/indexer/hash.ts` | `hashFile` | `function hashFile(absPath: string): string` | abs file | sha256 hex | reads file | same content -> same hash | read -> `FS_ERROR` | stable hash |
| `src/indexer/language.ts` | `classifyLanguage` | `function classifyLanguage(path: string): LanguageKind \| null` | relative path | lang/null | none | only `.ts,.tsx,.js,.jsx,.mts,.cts` v0.1 | none | extensions |
| `src/indexer/language.ts` | `isTestFile` | `function isTestFile(path: string): boolean` | path | boolean | none | `.spec/.test` and test dirs | none | patterns |
| `src/indexer/language.ts` | `isGeneratedFile` | `function isGeneratedFile(path: string): boolean` | path | boolean | none | generated deprioritized; may be indexed if included | none | patterns |
| `src/indexer/module-inference.ts` | `inferModuleId` | `function inferModuleId(filePath: string, config: ProjectMemoryConfig): string` | path/config | module id | none | lowercase/stable; config hints override | `VALIDATION_ERROR` | hints/path |
| `src/indexer/ast-indexer.ts` | `indexFileAst` | `function indexFileAst(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult` | abs/scanned/options | symbols/imports/routes/warnings | reads/parses file | parse failure returns warning, not project failure | parser setup fatal -> `INDEX_ERROR` | valid/invalid TS |
| `src/indexer/ast-indexer.ts` | `extractSymbolsFromSourceFile` | `function extractSymbolsFromSourceFile(sourceFile: SourceFile, fileIdHint?: number): SymbolRecord[]` | sourceFile | symbols | none | valid line ranges; stable signatures/hash best-effort | unsupported syntax warning via caller | symbol kinds |
| `src/indexer/ast-indexer.ts` | `extractImportExportEdges` | `function extractImportExportEdges(sourceFile: SourceFile): ImportExportEdgeInput[]` | sourceFile | import/export inputs | none | unresolved imports marked `resolved:false`; not persisted as edges | none | import forms |
| `src/indexer/route-indexer.ts` | `inferNestRoutes` | `function inferNestRoutes(sourceFile: SourceFile, symbols: SymbolRecord[]): RouteRecordInput[]` | source/symbols | routes | none | literal controller/method decorators only | dynamic route -> warning by caller | decorators |
| `src/indexer/dependency-graph.ts` | `resolveSymbolEdges` | `function resolveSymbolEdges(db: Database, imports: ImportExportEdgeInput[]): { edges: ResolvedSymbolEdgeInput[]; warnings: WarningRecordInput[] }` | imports | resolved edges + warnings | reads DB | unresolved not fatal; warnings returned | `DB_ERROR` | resolved/unresolved |
| `src/indexer/project-indexer.ts` | `indexProject` | `async function indexProject(ctx: RuntimeContext, options?: IndexOptions): Promise<IndexResult>` | ctx/options | summary | writes DB/state/warnings | per-file transaction; one bad file continues | fatal DB/config/fs -> `PmemError` | fixture index |
| `src/indexer/project-indexer.ts` | `indexChangedFiles` | `async function indexChangedFiles(ctx: RuntimeContext): Promise<IndexResult>` | ctx | changed summary | reads hashes/writes DB | unchanged skipped; deleted files removed via `removeFileRecordCascade` | recoverable where possible | changed/deleted |
| `src/indexer/test-adjacency.ts` | `inferTestTargets` | `function inferTestTargets(files: IndexedFileRecord[], symbols: SymbolRecord[]): TestLinkRecord[]` | files/symbols | links | none | heuristic only; never blocks retrieval | none | adjacent tests |

---

## P4 — generated JSON, renderer, frame registry

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/renderer/graph-builder.ts` | `buildNormalizedGraph` | `function buildNormalizedGraph(ctx: RuntimeContext, options?: GraphBuildOptions): NormalizedGraph` | ctx/options | graph | reads DB | no timestamps; stable sorted nodes/edges | `DB_ERROR`, `RENDER_ERROR` | fixture graph |
| `src/renderer/graph-builder.ts` | `canonicalizeGraph` | `function canonicalizeGraph(graph: NormalizedGraph): NormalizedGraph` | graph | canonical graph | none | deterministic order; removes volatile fields | `VALIDATION_ERROR` | stable order |
| `src/renderer/hash.ts` | `computeGraphSourceHash` | `function computeGraphSourceHash(graph: NormalizedGraph): string` | canonical graph | sha256 | none | excludes generatedAt/timestamps | `VALIDATION_ERROR` | same graph same hash |
| `src/renderer/generated-json.ts` | `writeGeneratedJson` | `function writeGeneratedJson(ctx: RuntimeContext, graph: NormalizedGraph): GeneratedJsonResult` | ctx/graph | paths/hashes | writes `generated/*.json` | atomic compact JSON; canonical order | `FS_ERROR`, `RENDER_ERROR` | valid JSON |
| `src/renderer/layout.ts` | `layoutGraph` | `function layoutGraph(graph: NormalizedGraph, options?: LayoutOptions): LayoutResult` | graph/options | layout | none | deterministic grid; no random; handles empty project | `RENDER_ERROR` | empty/20 modules |
| `src/renderer/svg-renderer.ts` | `renderSvg` | `function renderSvg(layout: LayoutResult): string` | layout | SVG string | none | escaped text; no timestamps; stable attribute order | `RENDER_ERROR` | snapshot |
| `src/renderer/map-writer.ts` | `buildFrameMap` | `function buildFrameMap(layout: LayoutResult, frame: FrameName): FrameMap` | layout/frame | map object | none | every visible item has id/kind/bbox; no absolute paths | `VALIDATION_ERROR` | schema |
| `src/renderer/map-writer.ts` | `writeFrameMap` | `function writeFrameMap(path: string, map: FrameMap): void` | path/map | void | writes JSON atomically | map valid even when PNG missing | `FS_ERROR`, `RENDER_ERROR` | schema/write |
| `src/renderer/frame-registry.ts` | `upsertFrame` | `function upsertFrame(db: Database, frame: FrameRecord): void` | frame | void | writes DB | frame id stable; svg/map not null; png nullable | `DB_ERROR` | upsert |
| `src/renderer/frame-registry.ts` | `getFrame` | `function getFrame(db: Database, id: FrameName): FrameRecord \| null` | id | frame/null | reads DB | paths relative memory root | `DB_ERROR` | current/missing |
| `src/renderer/frame-registry.ts` | `listFrames` | `function listFrames(db: Database): FrameRecord[]` | db | frames | reads DB | stable order current,overview,modules,duplicates,risks | `DB_ERROR` | order |
| `src/renderer/render-current.ts` | `renderCurrentFrame` | `async function renderCurrentFrame(ctx: RuntimeContext, options?: RenderOptions): Promise<RenderResult>` | ctx/options | summary | writes current.svg/map, optional png, generated JSON, frames | SVG + map success required; PNG best-effort | fatal -> `RENDER_ERROR`; PNG fail -> warning only | integration |
| `src/renderer/render-frames.ts` | `renderNamedFrame` | `async function renderNamedFrame(ctx: RuntimeContext, frame: FrameName, options?: RenderOptions): Promise<RenderResult>` | ctx/frame/options | summary | writes frame SVG/map/png | same deterministic rules as current | `FRAME_NOT_FOUND` for invalid frame | each frame |
| `src/renderer/svg-to-png.ts` | `exportSvgToPng` | `async function exportSvgToPng(svgPath: string, pngPath: string): Promise<PngExportResult>` | svg/png paths | `{ ok:boolean; warning?:string }` | reads SVG/writes PNG | failure never deletes SVG/map | returns ok false, no throw unless path safety | graceful fail |

RenderResult shape:

```ts
interface RenderResult {
  frame: FrameName;
  svg: string;
  png: string | null;
  map: string;
  generatedJson: string[];
  sourceHash: string;
  warnings: string[];
}
```

---

## P5 — micro-agent rule-based runtime

### 5.1 Retrieval scoring contract

Tokenizzazione v0.1:

```text
normalize lower-case
split on non-alphanumeric
split camelCase/PascalCase boundaries
remove tokens length < 2
no stemming, no embeddings
```

Score deterministico canonico:

```text
+40 exact module id/name token match
+30 symbol/fq_name token match
+25 path segment token match
+20 route path/method match
+15 test adjacency to selected source file
+10 criticalRule/module owns match
+5  active warning relevance
-30 generated file penalty
-10 test file penalty unless intent contains test/spec
```

Tie-break:

```text
score desc -> non-generated first -> non-test first -> path asc -> fqName asc -> id asc
```

### 5.2 Duplicate thresholds

```text
high   >= 0.80 -> extend_existing_artifact
medium >= 0.45 -> needs_human_review
low    <  0.45 -> create_new_artifact
```

Override obbligatorio:

```text
same artifact kind + same normalized proposedName/name + same moduleId -> high always
same route method+path or same table name -> high always
```

Formula similarity v0.1, clamp finale 0..1:

```text
+0.35 same ArtifactKind
+0.25 same moduleId or same first path segment
+0.20 normalized name token overlap >= 0.50
+0.10 intent token overlap >= 0.35
+0.05 same route/table/domain noun token
+0.05 adjacent test or same controller/service pair
-0.20 clearly different module ownership from config.mustNot
```

Normalizzazione duplicate: lowercase, split non-alphanumeric, split camelCase/PascalCase, remove suffixes `service/controller/dto/module/repository` only for comparison, no stemming/embedding.


| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/store/retrieval-log-repository.ts` | `addRetrievalLog` | `function addRetrievalLog(db: Database, log: RetrievalLogInput): number` | log | id | inserts log | output_json compact; no code dumps | `DB_ERROR` | insert |
| `src/store/duplicate-repository.ts` | `replaceDuplicateCandidates` | `function replaceDuplicateCandidates(db: Database, candidates: DuplicateCandidateRecord[]): void` | candidates | void | updates candidates | similarity 0..1; stable createdAt | `DB_ERROR` | replace/list |
| `src/agents/dispatcher.ts` | `dispatchAgent` | `async function dispatchAgent<N extends AgentName>(ctx: AgentContext, name: N, input: AgentInput<N>): Promise<AgentOutput<N>>` | ctx/name/input | typed output | reads DB; writes log if configured | Zod input/output; unknown agent rejected | `VALIDATION_ERROR`, `AGENT_ERROR` | routing/schema |
| `src/agents/retrieval-agent.ts` | `runRetrievalAgent` | `function runRetrievalAgent(ctx: AgentContext, input: RetrievalAgentInput): RetrievalAgentOutput` | ctx/input | context pack | reads DB | respects maxFiles/maxSymbols/maxWarnings; no code dumps | `AGENT_ERROR` | fixture query |
| `src/agents/retrieval-agent.ts` | `scoreRetrievalCandidates` | `function scoreRetrievalCandidates(intent: string, candidates: RetrievalCandidate[]): ScoredRetrievalCandidate[]` | intent/candidates | scored | none | scoring exactly as above | `VALIDATION_ERROR` | order cases |
| `src/agents/duplicate-agent.ts` | `runDuplicateAgent` | `function runDuplicateAgent(ctx: AgentContext, input: DuplicateAgentInput): DuplicateAgentOutput` | ctx/input | risk/verdict/matches/recommendation | reads DB | high-risk never returns create_new_artifact | `AGENT_ERROR` | AccessService high |
| `src/agents/duplicate-agent.ts` | `scoreDuplicateRisk` | `function scoreDuplicateRisk(input: DuplicateAgentInput, candidates: DuplicateCandidate[]): DuplicateRiskScore` | input/candidates | risk score/verdict | none | thresholds fixed unless config explicitly overrides later version | invalid -> `CONFIG_ERROR` | thresholds |
| `src/agents/drift-agent.ts` | `runDriftAgent` | `function runDriftAgent(ctx: AgentContext, input: DriftAgentInput): DriftAgentOutput` | state/files | drift output | reads DB/files metadata | dirty/stale/error distinction preserved | `AGENT_ERROR` | states |
| `src/agents/architecture-agent.ts` | `runArchitectureAgent` | `function runArchitectureAgent(ctx: AgentContext, input: ArchitectureAgentInput): ArchitectureAgentOutput` | modules/files/intent | constraints/warnings | reads config/modules/warnings | only explicit rules v0.1; no deep reasoning | `AGENT_ERROR` | criticalRules |
| `src/agents/render-agent.ts` | `runRenderAgent` | `async function runRenderAgent(ctx: AgentContext, input: RenderAgentInput): Promise<RenderAgentOutput>` | render input | render output | calls renderer | delegates data to renderer; no invented visual facts | render errors -> `AGENT_ERROR` | PNG warning propagation |

---

## P6 — MCP server and tools

Regola: gli handler validano input e restituiscono output typed. Non creano wrapper errore. `src/mcp/server.ts` cattura `PmemError` e lo mappa nel formato MCP compatto.

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/mcp/server.ts` | `createMcpServer` | `function createMcpServer(options?: McpServerOptions): McpServer` | options | server | none until started | registers exactly six v0.1 tools | `CONFIG_ERROR` | registry |
| `src/mcp/server.ts` | `startMcpServer` | `async function startMcpServer(server: McpServer): Promise<void>` | server | void | starts stdio | no stdout prose outside protocol | `MCP_ERROR` | stdio smoke |
| `src/mcp/server.ts` | `mapErrorToMcpPayload` | `function mapErrorToMcpPayload(error: unknown): { error: ErrorPayload }` | unknown | MCP error payload | none | uses `toErrorPayload`; never throws | unknown -> `INTERNAL_ERROR` | mappings |
| `src/mcp/tool-schemas.ts` | `getToolSchemas` | `function getToolSchemas(): MemoryToolSchemas` | none | schemas | none | schemas match `07_MCP_TOOL_CONTRACTS.md` | none | parse fixtures |
| `src/mcp/tools/head.ts` | `handleMemoryHead` | `async function handleMemoryHead(input: unknown, env: McpToolEnv): Promise<MemoryHeadOutput>` | input/env | head output | reads config/DB | empty input only; non-init returns status not_initialized | DB corrupt -> status error warning | non-init/fresh |
| `src/mcp/tools/query.ts` | `handleMemoryQuery` | `async function handleMemoryQuery(input: unknown, env: McpToolEnv): Promise<MemoryQueryOutput>` | input/env | query output | reads DB; logs via dispatcher | defaults from config; compact output | invalid -> `INVALID_INPUT`; non-init -> `NOT_INITIALIZED` | fixture intent |
| `src/mcp/tools/duplicates.ts` | `handleMemoryDuplicates` | `async function handleMemoryDuplicates(input: unknown, env: McpToolEnv): Promise<MemoryDuplicatesOutput>` | input/env | duplicate output | reads DB; may log candidates | kind required; intent non-empty | validation/agent errors | high/low |
| `src/mcp/tools/frame.ts` | `handleMemoryFrame` | `async function handleMemoryFrame(input: unknown, env: McpToolEnv): Promise<MemoryFrameOutput>` | input/env | frame paths | reads frame registry | no implicit render v0.1 | missing -> `FRAME_NOT_FOUND` | current/missing |
| `src/mcp/tools/refresh.ts` | `handleMemoryRefresh` | `async function handleMemoryRefresh(input: unknown, env: McpToolEnv): Promise<MemoryRefreshOutput>` | input/env | refresh summary | index/render/state | changedOnly default true; render default true | index/render fatal; PNG warning non-fatal | dirty/no changes |
| `src/mcp/tools/diff.ts` | `handleMemoryDiff` | `async function handleMemoryDiff(input: unknown, env: McpToolEnv): Promise<MemoryDiffOutput>` | input/env | diff | reads snapshots/current DB | minimal diff; no source code | missing snapshots -> empty diff + warning | snapshots |
| `src/runtime/snapshots.ts` | `createMemorySnapshot` | `function createMemorySnapshot(ctx: RuntimeContext, options?: SnapshotOptions): MemorySnapshot` | ctx/options | snapshot | reads DB; writes only if `options.write=true` | excludes volatile timestamps by default | `DB_ERROR`, `FS_ERROR` | stable snapshot |
| `src/runtime/snapshots.ts` | `readMemorySnapshot` | `function readMemorySnapshot(paths: MemoryPaths, ref: SnapshotRef): MemorySnapshot \| null` | paths/ref | snapshot/null | reads FS | ref limited to previous/latest/current labels | `VALIDATION_ERROR`, `FS_ERROR` | missing/latest |
| `src/runtime/snapshots.ts` | `diffMemorySnapshots` | `function diffMemorySnapshots(from: MemorySnapshot, to: MemorySnapshot): MemoryDiff` | snapshots | diff | none | sorted arrays; no code content | `VALIDATION_ERROR` | added/removed |

---

## P0-P8 — CLI command handlers

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/cli/commands/init.ts` | `cmdInit` | `async function cmdInit(options: InitOptions): Promise<CliResult<InitOutput>>` | options | init summary | creates memory tree/config/DB schema | idempotent; no source modifications | errors -> `CliResult.error` | init/reinit/force |
| `src/cli/commands/doctor.ts` | `cmdDoctor` | `async function cmdDoctor(options: DoctorOptions): Promise<CliResult<DoctorOutput>>` | options | diagnostics | reads FS/config/db | no writes v0.1 | errors reported as diagnostics where possible | non-init/corrupt |
| `src/cli/commands/scan.ts` | `cmdScan` | `async function cmdScan(options: ScanOptions): Promise<CliResult<ScanOutput>>` | options | scan summary | reads FS only | excludes `.codex/memory/**` | validation/fs errors | fixture scan |
| `src/cli/commands/index.ts` | `cmdIndex` | `async function cmdIndex(options: IndexCliOptions): Promise<CliResult<IndexOutput>>` | options | index summary | writes DB/state/warnings | file parse errors non-fatal | fatal mapped | fixture/changed |
| `src/cli/commands/render.ts` | `cmdRender` | `async function cmdRender(options: RenderCliOptions): Promise<CliResult<RenderOutput>>` | options | render summary | writes SVG/map/generated/optional PNG | PNG best-effort; SVG/map required | PNG warning non-fatal | deterministic |
| `src/cli/commands/head.ts` | `cmdHead` | `async function cmdHead(options: HeadOptions): Promise<CliResult<HeadOutput>>` | options | head | reads config/db | works before init | corrupt db -> status error if possible | states |
| `src/cli/commands/query.ts` | `cmdQuery` | `async function cmdQuery(intent: string, options: QueryOptions): Promise<CliResult<QueryOutput>>` | intent/options | context pack | reads DB; writes log | limits respected; no code dumps | validation/non-init/agent | fixture intent |
| `src/cli/commands/duplicates.ts` | `cmdDuplicates` | `async function cmdDuplicates(kind: ArtifactKind, intent: string, options: DuplicateOptions): Promise<CliResult<DuplicateOutput>>` | kind/intent/options | verdict | reads DB; may write candidates/log | high-risk guard | validation/agent | duplicate blocks |
| `src/cli/commands/refresh.ts` | `cmdRefresh` | `async function cmdRefresh(options: RefreshOptions): Promise<CliResult<RefreshOutput>>` | options | refresh summary | changed-only index + render | default changedOnly true; render unless no-render | mapped errors; PNG warning | dirty->fresh |
| `src/cli/commands/frame.ts` | `cmdFrame` | `async function cmdFrame(frame: FrameName, options: FrameOptions): Promise<CliResult<FrameOutput>>` | frame/options | paths | reads registry | no implicit render | missing -> error payload | missing/current |
| `src/cli/commands/diff.ts` | `cmdDiff` | `async function cmdDiff(options: DiffOptions): Promise<CliResult<DiffOutput>>` | options | diff | reads snapshots/db | empty diff + warning if missing | mapped errors | empty/changed |
| `src/cli/commands/agents.ts` | `cmdAgentsInstall` | `async function cmdAgentsInstall(options: AgentsInstallOptions): Promise<CliResult<AgentsInstallOutput>>` | options | installed/skipped | writes `.codex/agents/*.toml` | no overwrite without force; templates read-only | `ALREADY_EXISTS`, `FS_ERROR` | install/force |
| `src/cli/commands/agents.ts` | `cmdAgentsList` | `async function cmdAgentsList(options: AgentsListOptions): Promise<CliResult<AgentsListOutput>>` | options | list | reads templates/project agents | no writes | `FS_ERROR` recoverable | list output |

---

## P7 — hooks

### 7.1 Hook loop guard

`Stop` deve usare entrambi:

```text
if process.env.PMEM_HOOK_RUNNING === "1" -> no-op warning "hook_loop_guard_env"
if .codex/memory/cache/hook-refresh.lock exists and not expired -> no-op warning "hook_loop_guard_lock"
when invoking refresh from Stop, set PMEM_HOOK_RUNNING=1 and create lock with TTL 5 minutes
cleanup lock best-effort after refresh
```

### 7.2 Hook function contracts

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/hooks/shared.ts` | `readHookInput` | `async function readHookInput(stdin?: NodeJS.ReadStream): Promise<HookInputResult>` | stdin | event+warnings | reads stdin | empty -> `{ event:{}, warnings:[] }`; invalid JSON -> `{ event:{}, warnings:[...] }` | never throws for parse | empty/invalid |
| `src/hooks/shared.ts` | `writeHookJson` | `function writeHookJson(value: HookOutput): void` | HookOutput | void | writes stdout | compact JSON only | serialization failure writes safe no-op JSON | shape |
| `src/hooks/shared.ts` | `resolveHookRuntimeContext` | `function resolveHookRuntimeContext(event: unknown): RuntimeContext \| null` | event | context/null | reads cwd/env/config maybe DB | no throw for missing/non-init | invalid root -> null | missing event |
| `src/hooks/shared.ts` | `isHookLoopGuardActive` | `function isHookLoopGuardActive(paths: MemoryPaths): boolean` | paths | boolean | reads env/lock | true blocks Stop refresh | FS read error -> true + warning by caller | env/lock |
| `src/hooks/shared.ts` | `withHookLoopGuard` | `async function withHookLoopGuard<T>(paths: MemoryPaths, fn: () => Promise<T>): Promise<T>` | paths/fn | callback result | writes/removes lock; sets env for child process | lock TTL 5 minutes | cleanup best-effort | lock lifecycle |
| `src/hooks/user-prompt-submit.ts` | `runUserPromptSubmitHook` | `async function runUserPromptSubmitHook(event: unknown): Promise<HookOutput>` | event | additional context/noop | reads memory state only | no scan/index/render; safe pre-init | errors -> no-op warning | non-init/dirty/fresh |
| `src/hooks/post-tool-use.ts` | `runPostToolUseHook` | `async function runPostToolUseHook(event: unknown): Promise<HookOutput>` | event | marked_dirty/noop | marks dirty if repo files changed | ignores `.codex/memory/**`; no refresh | DB errors warning, no crash | changed/no changed |
| `src/hooks/stop.ts` | `runStopHook` | `async function runStopHook(event: unknown): Promise<HookOutput>` | event | refreshed/noop | may run changed-only refresh | only dirty + config enabled + under max files + loop guard false | refresh failure warning, protocol intact | dirty refresh/no loop |
| `src/hooks/subagent-stop.ts` | `runSubagentStopHook` | `async function runSubagentStopHook(event: unknown): Promise<HookOutput>` | event | logged/noop | may append retrieval log/warning | no source modification; parse best-effort | parse errors warning | structured/unstructured |

---

## P8 — optional Codex subagent templates

| File | Funzione/simbolo | Signature | Input | Output | Side effects | Invarianti | Error handling | Test |
|---|---|---|---|---|---|---|---|---|
| `src/agents/templates.ts` | `renderAgentTemplate` | `function renderAgentTemplate(templateName: AgentTemplateName, vars: AgentTemplateVars): string` | template/vars | TOML content | none | retriever/duplicate sandbox read-only; instructions MCP-first | missing -> `TEMPLATE_ERROR` | TOML constraints |
| `src/agents/templates.ts` | `listAgentTemplates` | `function listAgentTemplates(): AgentTemplateDescriptor[]` | none | descriptors | none | only approved v0.1 templates | none | list |
| `src/agents/templates.ts` | `installAgentTemplates` | `function installAgentTemplates(projectRoot: string, options?: { force?: boolean }): AgentsInstallOutput` | root/options | installed/skipped | writes `.codex/agents` | no overwrite without force | `ALREADY_EXISTS`, `FS_ERROR` | install/force |

Template obbligatori:

```text
pmem-retriever.toml
pmem-duplicate-checker.toml
pmem-architecture-reviewer.toml
```

---

## 8.1 Policy helper privati

Un agente può creare helper non elencati nelle tabelle solo se tutte queste condizioni sono vere:

1. il file helper resta nello stesso modulo del chiamante;
2. non è importato da CLI, MCP o hook come API pubblica;
3. non introduce nuovi side effect non documentati;
4. non cambia shape di output pubblico;
5. non richiede nuove tabelle, comandi, tool o config fields;
6. ha test se contiene path safety, serializzazione, parsing o calcolo scoring.

Esempi ammessi: `normalizeTokens()`, `sortByPathAsc()`, `escapeSvgText()`.
Esempi non ammessi senza aggiornare `04`: `createMemoryServer()`, `exportDbDump()`, `summarizeWithModel()`, `writeSourcePatch()`.

---

## 9. Contratto di copertura per funzione

Una funzione è pronta solo se:

1. compila con TypeScript strict;
2. ha input/output typed;
3. valida input esterno;
4. rispetta side effects dichiarati;
5. usa path safety quando legge/scrive filesystem;
6. usa atomic write per JSON/SVG/map/config;
7. emette o propaga `PmemError` coerente;
8. ha test indicato nella tabella;
9. non amplia il perimetro v0.1;
10. non richiede modello/embedding/subagente nella core path.

---

## 10. Allineamento consolidato sugli altri documenti

Dopo il global-pass5 autonomous-ready, questi contratti sono considerati allineati e non pending:

| Documento | Stato allineamento |
|---|---|
| `05_DATA_MODEL_SQLITE.md` | allineato: no `features` table, hard delete cascade, warning fingerprint/dedupe, resolved-only symbol edges, PNG nullable |
| `06_CLI_CONTRACTS.md` | allineato: error enum canonico, PNG nullable, `doctor` schema checks, comandi vietati esclusi |
| `07_MCP_TOOL_CONTRACTS.md` | allineato: output `visualFrame`/`frame` come `{ svg, png, map }`, error enum canonico, error mapping nel server MCP |
| `08_RENDERER_VISUAL_CONTRACT.md` | allineato: SVG/map obbligatori, PNG nullable, source hash senza timestamp, atomic writes |
| `09_AGENTS_AND_HOOKS_CONTRACT.md` | allineato: scoring deterministico, duplicate thresholds, hook loop guard env+lock, HookOutput shape |
| `10_TEST_PLAN_AND_ACCEPTANCE.md` | allineato: `current.png` opzionale; `png_export_failed` warning accettato |
| `11_CODEX_IMPLEMENTATION_PROMPTS.md` | allineato: prompt pass-by-pass vietano scope creep e vietano PNG obbligatorio |
| `12_DEMO_SCENARIO.md` | allineato: demo accetta PNG assente e verifica hard delete cascade |
| `13_OPEN_ITEMS_AND_GUARDS.md` | allineato: guardrail bloccano scope creep già escluso dai contratti |
