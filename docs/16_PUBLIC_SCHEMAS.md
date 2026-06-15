# Codex Project Memory Plugin — public schemas v0.1

**Stato:** schema pubblici autoritativi per config, CLI, MCP, renderer, snapshot, errori e warning.
**Scopo:** eliminare output “simili ma non identici”.  
**Regola:** CLI/MCP/generated/map/snapshot devono validare contro questo documento. Esempi in `06`, `07`, `08`, `09` e `12` sono illustrativi se divergono da questo file.

---

## 1. Convenzioni globali

### 1.1 Primitive

```text
RelativePath = string POSIX senza backslash, senza path assoluto, senza segmento ".."
MemoryPath = RelativePath che inizia con ".codex/memory/" oppure esattamente ".codex/memory"
AgentPath = RelativePath che inizia con ".codex/agents/"
IsoDateTime = string ISO 8601 UTC, esempio "2026-06-09T00:00:00.000Z"
Sha256 = string con formato "sha256:" + 64 hex lowercase
Score = number finite, 0..1 se similarity, altrimenti score intero/decimale documentato
```

### 1.2 Policy campi extra

| Output | Campi extra |
|---|---|
| CLI `CliResult` | vietati al top-level; `data` può avere solo campi dello schema comando |
| MCP tool output | vietati salvo future schema version documentata |
| Config | chiavi sconosciute vietate; chiavi legacy possono generare `config_deprecated_key` solo se documentate |
| Generated JSON | vietati nei file canonici salvo bump schema |
| Frame map | vietati al top-level; `items[].metadata` ammesso solo se oggetto compatto senza path assoluti |
| Snapshot | vietati salvo bump `version` |

### 1.3 Ordine proprietà per JSON stabile

Ogni writer pubblico deve costruire oggetti in questo ordine:

```text
version/schema fields -> identity/name fields -> status fields -> path fields -> counts/summary fields -> arrays -> warnings -> metadata/details
```

Per `CliResult`:

```text
ok, data, error, warnings
```

Per error payload:

```text
code, message, recoverable, details
```

Per frame ref:

```text
frame, svg, png, map, sourceHash, generatedAt
```

---

## 2. Enum canonici

```ts
type MemoryStatus = "not_initialized" | "initializing" | "fresh" | "stale" | "dirty" | "error";
type MemoryEvent = "init_started" | "init_completed" | "index_started" | "index_completed" | "render_completed" | "mark_dirty" | "mark_error" | "doctor_ok";
type LanguageKind = "typescript" | "javascript";
type WarningSeverity = "info" | "warning" | "critical";
type WarningSource = "parser" | "indexer" | "renderer" | "agent" | "mcp" | "config" | "inferred";
type RiskLevel = "low" | "medium" | "high";
type DuplicateVerdict = "create_new_artifact" | "extend_existing_artifact" | "needs_human_review";
type FrameName = "current" | "overview" | "modules" | "duplicates" | "risks";
type FrameType = "current" | "overview" | "module_map" | "duplicate_map" | "risk_map";
type AgentName = "retrieval" | "duplicate" | "drift" | "architecture" | "render";

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
  | "feature"
  | "class"
  | "function"
  | "method"
  | "const"
  | "provider";
```

Nota: `feature` resta un artifact kind lessicale per compatibility di output, ma non autorizza tabella `features` o runtime feature extraction in v0.1.

---

## 3. Error schema e catalogo

### 3.1 `PmemErrorCode`

```ts
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
  | "SAFETY_ERROR"
  | "STATE_ERROR"
  | "FRAME_NOT_FOUND"
  | "TEMPLATE_ERROR"
  | "INTERNAL_ERROR";
```

### 3.2 `ErrorPayload`

```ts
interface ErrorPayload {
  code: PmemErrorCode;
  message: string;        // 1..300 chars, no stack trace
  recoverable: boolean;
  details?: Record<string, JsonValue>; // no absolute paths, no source code
}
```

Default recoverability:

| Code | recoverable |
|---|---:|
| `INVALID_INPUT`, `VALIDATION_ERROR`, `NOT_INITIALIZED`, `ALREADY_EXISTS`, `CONFIG_ERROR`, `FS_ERROR`, `INDEX_ERROR`, `RENDER_ERROR`, `AGENT_ERROR`, `MCP_ERROR`, `STATE_ERROR`, `FRAME_NOT_FOUND`, `TEMPLATE_ERROR` | true |
| `DB_ERROR`, `SAFETY_ERROR`, `INTERNAL_ERROR` | false |

Default message e next command:

| Code | Default message | details consigliato |
|---|---|---|
| `NOT_INITIALIZED` | `Project memory is not initialized. Run pmem init.` | `{ "nextCommand": "pmem init --json" }` |
| `FRAME_NOT_FOUND` | `Requested memory frame was not found.` | `{ "nextCommand": "pmem render --json" }` |
| `CONFIG_ERROR` | `Project memory config is invalid.` | `{ "config": ".codex/memory/project-memory.config.json" }` |
| `DB_ERROR` | `Project memory database error.` | `{ "db": ".codex/memory/memory.db" }` |
| `SAFETY_ERROR` | `Path safety check failed.` | omit unsafe path |

---

## 4. Warning catalog

### 4.1 Warning persistenti DB

Questi valori sono ammessi in `warnings.warning_type`:

| warning_type | source | severity default | Persistenza |
|---|---|---:|---|
| `parse_error` | `parser` | `warning` | per-file replace |
| `unsupported_language` | `indexer` | `info` | per-file replace |
| `file_too_large` | `indexer` | `warning` | per-file replace |
| `unresolved_import` | `indexer` | `warning` | per-file replace |
| `dynamic_route` | `indexer` | `info` | per-file replace |
| `test_target_unresolved` | `indexer` | `info` | per-file replace |
| `png_export_failed` | `renderer` | `warning` | global/run warning |
| `frame_stale` | `renderer` | `info` | global/run warning |
| `duplicate_high_risk` | `agent` | `warning` | duplicate run/candidate warning |
| `architecture_rule_violation` | `agent` | `warning` | agent/config warning |
| `config_deprecated_key` | `config` | `info` | config warning |
| `legacy_table_features` | `config` | `info` | doctor/config warning |

### 4.2 Warning transienti di output

Queste stringhe possono apparire in `CliResult.warnings` o output MCP, ma non vanno inserite automaticamente nella tabella `warnings` salvo mapping esplicito sopra:

```text
render_skipped
png_missing
snapshot_missing
config_missing
memory_dirty
memory_stale
not_initialized
```

Formato stringa warning pubblico:

```text
<code>: <message breve>
```

Esempi:

```text
png_export_failed: sharp native dependency unavailable
snapshot_missing: previous
render_skipped: visual frame may be stale
```

---

## 5. Config schema autoritativo

### 5.1 `ProjectMemoryConfig`

```ts
interface ProjectMemoryConfig {
  schemaVersion: 1;
  projectName: string;              // 1..120 chars
  scan: {
    include: string[];              // glob list, min 1
    exclude: string[];
    languages: LanguageKind[];      // subset of [typescript,javascript], min 1
    maxFileBytes: number;           // integer 1024..5242880
  };
  modules: Array<{
    id: string;                     // lowercase slug [a-z0-9][a-z0-9_-]*
    name: string;                   // 1..120 chars
    rootPath?: RelativePath;
    owns?: string[];
    mustNot?: string[];
    dependencies?: string[];        // module ids
    riskLevel?: "normal" | "high";
  }>;
  criticalRules: string[];          // each 1..200 chars
  render: {
    png: boolean;
    maxModules: number;             // integer 1..200
    maxWarnings: number;            // integer 0..100
  };
  agents: {
    maxFiles: number;               // integer 1..20
    maxSymbols: number;             // integer 1..40
    maxWarnings: number;            // integer 0..20
  };
}
```

### 5.2 Default config esatto

```json
{
  "schemaVersion": 1,
  "projectName": "auto",
  "scan": {
    "include": ["src/**/*", "apps/**/*", "packages/**/*"],
    "exclude": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".next/**",
      ".turbo/**",
      ".git/**",
      ".codex/memory/**"
    ],
    "languages": ["typescript", "javascript"],
    "maxFileBytes": 524288
  },
  "modules": [],
  "criticalRules": [],
  "render": {
    "png": true,
    "maxModules": 40,
    "maxWarnings": 20
  },
  "agents": {
    "maxFiles": 8,
    "maxSymbols": 12,
    "maxWarnings": 8
  }
}
```

### 5.3 Merge e validazione

- Config assente: ammessa solo per `doctor`, `head`, `memory.head` e `agents list/install`.
- Config parziale: merge deep con default, poi validazione.
- `projectName="auto"`: a runtime diventa `package.json.name`, altrimenti basename project root.
- `scan.exclude` viene sempre forzato a includere `.codex/memory/**`, anche se mancante nel file utente.
- Chiavi sconosciute: `CONFIG_ERROR`, salvo legacy key documentata come warning `config_deprecated_key`.
- Legacy `hooks`: se presente da versioni draft precedenti, viene ignorato e non abilita alcun comportamento runtime.
- `criticalRules` mancante: default `[]`.
- `modules[].owns`, `mustNot`, `dependencies` mancanti: default `[]`; `riskLevel` default `normal`.

### 5.4 `configHash`

Algoritmo:

```text
1. load + deep-merge default
2. resolve projectName auto
3. force .codex/memory/** in scan.exclude
4. normalize path separators to POSIX for path/glob fields
5. sort object keys recursively
6. sort arrays only when semantic order does not matter:
   - scan.exclude yes
   - scan.include no
   - scan.languages yes
   - modules by id yes
   - modules owns/mustNot/dependencies yes
   - criticalRules no
7. stringify compact JSON
8. sha256 -> "sha256:<hex>"
```

---

## 6. CLI schemas

### 6.1 Wrapper

```ts
interface CliResult<T> {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
  warnings: string[];
}
```

Rules:

```text
ok=true  -> data required, error absent
ok=false -> error required, data absent
warnings always present
```

### 6.2 Shared shapes

```ts
interface CliFramePath {
  frame: FrameName;
  svg: MemoryPath;
  png: MemoryPath | null;
  map: MemoryPath;
  sourceHash?: Sha256;
  generatedAt?: IsoDateTime;
}

interface CliCheck {
  id: string;
  status: "ok" | "warning" | "error" | "skipped";
  message: string;
  details?: Record<string, JsonValue>;
}
```

### 6.3 Command data schemas

```ts
interface InitOutput {
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  config: ".codex/memory/project-memory.config.json";
  db: ".codex/memory/memory.db";
  schemaVersion: 1;
  created: MemoryPath[];
  skipped: MemoryPath[];
}

interface DoctorOutput {
  overallStatus: "ok" | "warning" | "error" | "not_initialized";
  memoryRoot: ".codex/memory";
  state: {
    status: MemoryStatus;
    schemaVersion: string | null;
    lastIndexedAt: IsoDateTime | null;
    lastRenderedAt: IsoDateTime | null;
    memoryDirty: boolean;
    dirtyReason: string;
    lastError: ErrorPayload | null;
  };
  checks: CliCheck[];
  schema: {
    userVersion: number | null;
    schemaVersion: string | null;
    foreignKeysEnabled: boolean | null;
    requiredTablesPresent: boolean;
    forbiddenTables: string[];
  };
  frames: {
    current: CliFramePath | null;
    available: FrameName[];
  };
  capabilities: {
    diagnostics: {
      status: "ok" | "degraded" | "not_initialized";
      hardGate: false;
      message: string;
      diagnosticsStored: number;
      degradedLanguages: string[];
      failedTools: string[];
    };
  };
}

interface ScanOutput {
  files: {
    scanned: number;
    included: number;
    excluded: number;
    tooLarge: number;
    unsupported: number;
  };
  roots: string[];
  warnings: string[];
}

interface IndexOutput {
  changedOnly: boolean;
  files: {
    scanned: number;
    indexed: number;
    skippedUnchanged: number;
    deleted: number;
    failed: number;
  };
  records: {
    modules: number;
    symbols: number;
    symbolEdges: number;
    routes: number;
    tests: number;
    warningsActive: number;
    warningsAdded: number;
    warningsResolved: number;
  };
  state: {
    status: MemoryStatus;
    memoryDirty: boolean;
  };
}

interface RenderOutput {
  frames: CliFramePath[];
  generatedJson: MemoryPath[];
  pngExported: boolean;
  sourceHash: Sha256;
}

interface HeadOutput {
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  schemaVersion: string | null;
  lastIndexedAt: IsoDateTime | null;
  lastRenderedAt: IsoDateTime | null;
  memoryDirty: boolean;
  dirtyReason: string;
  lastError: ErrorPayload | null;
  currentFrame: CliFramePath | null;
  activeWarnings: number;
}

interface QueryOutput {
  intent: string;
  contextPack: ContextPack;
}

interface DuplicateOutput {
  kind: ArtifactKind;
  intent: string;
  risk: RiskLevel;
  verdict: DuplicateVerdict;
  matches: DuplicateCandidate[];
  recommendation: string;
}

interface RefreshOutput {
  changedOnly: true;
  reason: string;
  index: {
    filesScanned: number;
    filesIndexed: number;
    filesDeleted: number;
    warningsActive: number;
  };
  render: {
    skipped: boolean;
    frames: CliFramePath[];
    pngExported: boolean;
  };
  state: {
    status: MemoryStatus;
    memoryDirty: boolean;
  };
}

interface FrameOutput extends CliFramePath {
  summary: {
    nodes: number;
    edges: number;
    warnings: number;
  };
}

interface DiffOutput {
  from: "previous" | "latest" | "current" | RelativePath;
  to: "previous" | "latest" | "current" | RelativePath;
  changedFiles: RelativePath[];
  addedFiles: RelativePath[];
  removedFiles: RelativePath[];
  changedModules: string[];
  addedSymbols: string[];
  removedSymbols: string[];
  changedWarnings: {
    added: string[];
    resolved: string[];
  };
}

interface AgentsInstallOutput {
  scope: "project";
  installed: AgentPath[];
  skipped: AgentPath[];
  overwritten: AgentPath[];
}

interface AgentsListOutput {
  available: Array<{ name: string; template: string }>;
  installed: Array<{ name: string; path: AgentPath }>;
}
```

---

## 7. Agent schemas

```ts
interface ContextPack {
  summary: string;                       // 1..500 chars
  modules: ContextModule[];              // <= maxFiles-ish, sorted score desc
  files: ContextFile[];
  symbols: ContextSymbol[];
  constraints: string[];
  warnings: ContextWarning[];
  nextCommands: string[];
  visualFrame?: FrameRef;
}

interface ContextModule {
  id: string;
  name: string;
  reason: string;
  score: number;
}

interface ContextFile {
  path: RelativePath;
  moduleId?: string;
  reason: string;
  score: number;
  isTest?: boolean;
}

interface ContextSymbol {
  fqName: string;
  kind: string;
  filePath: RelativePath;
  reason: string;
  score: number;
}

interface ContextWarning {
  severity: WarningSeverity;
  message: string;
  filePath?: RelativePath;
  recommendation?: string;
}

interface FrameRef {
  frame: FrameName;
  svg: MemoryPath;
  png: MemoryPath | null;
  map: MemoryPath;
}

interface DuplicateCandidate {
  kind: ArtifactKind;
  symbolId?: number;
  fileId?: number;
  name: string;
  fqName?: string;
  filePath?: RelativePath;
  path?: RelativePath;       // MCP compatibility alias; prefer filePath in CLI/internal
  moduleId?: string;
  similarity: number;        // 0..1
  reason: string;
}
```

---

## 8. MCP schemas

MCP success outputs are typed objects, not `CliResult`.

```ts
interface MemoryHeadInput {}
interface MemoryHeadOutput {
  project: string | null;
  branch: string | null;
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  visualFrame: FrameRef | null;
  lastIndexedAt: IsoDateTime | null;
  lastRenderedAt: IsoDateTime | null;
  topModules: Array<{ id: string; name: string; riskLevel?: "normal" | "high" }>;
  criticalRules: string[];
  warnings: string[];
  nextCommands: string[];
}

interface MemoryQueryInput {
  intent: string;             // trim, 3..500
  maxFiles?: number;          // 1..20 default config.agents.maxFiles
  maxSymbols?: number;        // 1..40 default config.agents.maxSymbols
  maxWarnings?: number;       // 0..20 default config.agents.maxWarnings
  includeVisualFrame?: boolean;
}
interface MemoryQueryOutput {
  intent: string;
  contextPack: ContextPack;
}

interface MemoryDuplicatesInput {
  kind: ArtifactKind;
  intent: string;             // trim, 3..500
  moduleId?: string;
  proposedName?: string;
}
interface MemoryDuplicatesOutput {
  risk: RiskLevel;
  verdict: DuplicateVerdict;
  matches: DuplicateCandidate[];
  recommendation: string;
}

interface MemoryFrameInput { frame: FrameName }
interface MemoryFrameOutput {
  frame: FrameName;
  svg: MemoryPath;
  png: MemoryPath | null;
  map: MemoryPath;
  summary: string;
  warnings: string[];
}

interface MemoryRefreshInput {
  changedOnly?: boolean;      // default true
  render?: boolean;           // default true
  reason?: string;            // default "manual", max 200
}
interface MemoryRefreshOutput {
  status: "updated" | "no_changes" | "stale";
  changedOnly: boolean;
  changedFiles: number;
  indexedFiles: number;
  deletedFiles: number;
  updatedTables: string[];
  updatedFrames: FrameName[];
  visualFrame: FrameRef | null;
  warnings: string[];
}

interface MemoryDiffInput {
  from?: "previous" | "latest" | "current" | RelativePath;
  to?: "previous" | "latest" | "current" | RelativePath;
}
interface MemoryDiffOutput {
  changedFiles: RelativePath[];
  changedModules: string[];
  addedSymbols: string[];
  removedSymbols: string[];
  newWarnings: string[];
  resolvedWarnings: string[];
  warnings: string[];
}

type AgentRunPhase = "pre_task" | "pre_create" | "post_change" | "review" | "orient";
type AgentRunStatus = "ready" | "initialized" | "refreshed" | "blocked" | "needs_review";

interface MemoryAgentInput {
  intent: string;             // trim, 3..500
  phase?: AgentRunPhase;      // default pre_task
  artifact?: {
    kind: ArtifactKind;
    moduleId?: string;
    proposedName?: string;
  };
  allowInit?: boolean;        // default true
  allowRefresh?: boolean;     // default true
  render?: boolean;           // default true
}
interface MemoryAgentOutput {
  version: 2;
  status: AgentRunStatus;
  actions: Array<{
    name: "head" | "init" | "refresh" | "query" | "duplicates" | "frame" | "diff";
    status: "completed" | "skipped" | "blocked";
    reason: string;
  }>;
  head: HeadOutput;
  query?: QueryOutput;
  duplicates?: DuplicateOutput;
  refresh?: RefreshOutput;
  frame?: FrameOutput;
  diff?: DiffOutput;
  decision: {
    verdict: "continue" | "create_new_artifact" | "extend_existing_artifact" | "needs_human_review" | "blocked";
    message: string;
    filesToOpen: RelativePath[];
    nextCommands: string[];
  };
  warnings: string[];
}
```

MCP error envelope:

```ts
interface McpErrorEnvelope {
  error: ErrorPayload;
}
```

---

## 9. Renderer schemas

### 9.1 `NormalizedGraph`

```ts
interface NormalizedGraph {
  version: 1;
  project: {
    name: string;
    status: MemoryStatus;
    generatedAt?: IsoDateTime; // excluded from sourceHash
  };
  modules: GraphModule[];
  files: GraphFile[];
  symbols: GraphSymbol[];
  routes: GraphRoute[];
  warnings: GraphWarning[];
  duplicateCandidates: GraphDuplicateCandidate[];
  edges: GraphEdge[];
  criticalRules: string[];
}

interface GraphModule {
  id: string;
  name: string;
  rootPath?: RelativePath;
  owns: string[];
  mustNot: string[];
  dependencies: string[];
  riskLevel: "normal" | "high";
}

interface GraphFile {
  id: number;
  path: RelativePath;
  moduleId: string | null;
  language: LanguageKind | null;
  isTest: boolean;
  isGenerated: boolean;
}

interface GraphSymbol {
  id: number;
  fqName: string;
  name: string;
  kind: ArtifactKind;
  filePath: RelativePath;
  moduleId: string | null;
  exported: boolean;
}

interface GraphRoute {
  id: number;
  method: string;
  path: string;
  filePath: RelativePath;
  handler?: string;
  moduleId?: string;
}

interface GraphWarning {
  id: number;
  warningType: string;
  severity: WarningSeverity;
  message: string;
  filePath?: RelativePath;
  moduleId?: string;
}

interface GraphDuplicateCandidate {
  id: number;
  kind: ArtifactKind;
  name: string;
  filePath?: RelativePath;
  moduleId?: string;
  similarity: number;
  reason: string;
}

interface GraphEdge {
  id: number;
  fromSymbolId: number;
  toSymbolId: number;
  from: string;
  to: string;
  edgeKind: "import" | "export" | "dependency";
  confidence: number;
}
```

Sort canonico:

```text
modules: id asc
files: path asc
symbols: fqName asc, filePath asc, id asc
routes: method asc, path asc, filePath asc
warnings: severity critical > warning > info, filePath asc, message asc, id asc
duplicateCandidates: similarity desc, moduleId asc, name asc, id asc
edges: from asc, to asc, edgeKind asc, id asc
criticalRules: input order preserved
```

### 9.2 Generated JSON files

`writeGeneratedJson` must write:

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

### 9.3 `FrameMap`

```ts
interface FrameMap {
  version: 1;
  frame: FrameName;
  svg: MemoryPath;
  png: MemoryPath | null;
  sourceHash: Sha256;
  items: FrameMapItem[];
}

interface FrameMapItem {
  id: string;
  kind: "module" | "file" | "symbol" | "route" | "warning" | "duplicate" | "rule";
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  paths: RelativePath[];
  symbols: string[];
  commands: string[];
  metadata?: Record<string, JsonValue>;
}
```

Frame map constraints:

```text
bbox numbers finite >= 0
commands read-only or memory commands only
commands allowed prefixes: pmem query, pmem frame, pmem render, pmem refresh --changed-only, memory.query, memory.frame, memory.refresh
SVG data-pmem-id must equal FrameMap.items[].id for every visible item
```

---

## 10. Supported lifecycle schema

Codex app plugin validation does not accept plugin-declared hooks in v0.1 packaging. The lifecycle equivalent is declared through the skill and agent artifacts:

```yaml
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

Required lifecycle mapping:

```text
Prompt start -> memory.agent phase=pre_task
Implementation intent -> memory.agent phase=pre_task
New artifact intent -> memory.agent phase=pre_create with artifact
After source changes -> memory.agent phase=post_change
Visual orientation -> memory.agent phase=orient
Review/closeout -> memory.agent phase=review
```

The six granular tools remain supported for narrow reads/debugging: `memory.head`, `memory.query`, `memory.duplicates`, `memory.frame`, `memory.refresh`, `memory.diff`.

---

## 11. Snapshot and diff schemas

### 11.1 Snapshot

```ts
interface MemorySnapshot {
  version: 1;
  createdAt: IsoDateTime;
  schemaVersion: "1" | null;
  configHash: Sha256 | null;
  files: Array<{
    path: RelativePath;
    hash: Sha256;
    moduleId: string | null;
  }>;
  symbols: Array<{
    fqName: string;
    kind: ArtifactKind;
    filePath: RelativePath;
    signatureHash?: Sha256;
    bodyHash?: Sha256;
  }>;
  warnings: Array<{
    warningType: string;
    severity: WarningSeverity;
    filePath?: RelativePath;
    fingerprint: Sha256;
  }>;
  frames: Array<{
    id: FrameName;
    svgPath: MemoryPath;
    pngPath: MemoryPath | null;
    mapPath: MemoryPath;
    sourceHash: Sha256;
  }>;
}
```

Sort:

```text
files path asc
symbols fqName asc, filePath asc
warnings warningType asc, filePath asc, fingerprint asc
frames order current, overview, modules, duplicates, risks
```

### 11.2 Snapshot lifecycle

```text
init: create no snapshot
index/refresh before DB mutation: if latest exists, copy latest -> previous atomically
index/refresh success: write latest.snapshot.json atomically from current DB and frame records
index/refresh failure: do not overwrite latest; previous may contain pre-run latest
render success: do not rotate; rewrite latest.snapshot.json in place if latest exists, otherwise create latest
render failure: no snapshot write
diff: no snapshot write
```

`current` snapshot ref is virtual: it is built from current DB/frame records in memory and is not persisted unless caller explicitly writes `latest` through lifecycle above.

### 11.3 Diff

Internal `MemoryDiff`:

```ts
interface MemoryDiff {
  changedFiles: RelativePath[];
  changedModules: string[];
  addedSymbols: string[];
  removedSymbols: string[];
  newWarnings: string[];
  resolvedWarnings: string[];
  warnings: string[];
}
```

CLI `DiffOutput` wraps added/removed files and changedWarnings as in section 6.3. MCP `MemoryDiffOutput` uses the internal compact shape.

---

## 12. Plugin artifact schemas

```ts
interface PluginManifest {
  name: "codex-project-memory";
  version: "0.2.0";
  description: string;
  author: { name: string; email?: string; url?: string };
  skills: "./skills/";
  mcpServers: "./.mcp.json";
  keywords: string[];
  interface: {
    displayName: "Codex Project Memory";
    shortDescription: string;
    longDescription: string;
    developerName: string;
    category: "Productivity";
    capabilities: string[];
    defaultPrompt: string[];
    brandColor: string;
    composerIcon?: "./assets/icon.png";
    logo?: "./assets/logo.png";
  };
}

interface McpConfig {
  mcpServers: {
    "project-memory": { command: "node"; args: ["dist/mcp/server.js"] }
  };
}
```

Plugin-declared hooks are not part of the v0.2 Codex app package because current local plugin validation rejects the `hooks` manifest field. The supported lifecycle replacement is `skills/repo-memory/agents/openai.yaml` with `policy.allow_implicit_invocation=true`, `memory.agent` and the six granular MCP tools declared under `dependencies.tools`.

No additional transport fields in v0.2.
