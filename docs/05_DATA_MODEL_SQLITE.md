# Codex Project Memory Plugin — data model SQLite v0.1

**Stato:** data model SQLite raffinato global-pass5 autonomous-ready, allineato a funzione/CLI/MCP/renderer/test.  
**Marker:** `PMEM05-GLOBAL-PASS5-20260613`.  
**Store:** SQLite locale per repository.  
**Path DB:** `.codex/memory/memory.db`.  
**Autorità:** `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` resta fonte operativa primaria; `04_FUNCTION_CONTRACTS.md` vincola funzioni e tipi; questo documento vincola schema SQLite, indici, repository data lifecycle e acceptance dati.  
**Principio:** il DB è un dettaglio interno. Codex deve passare da MCP/CLI/runtime; nessun tool pubblico v0.1 espone SQL diretto.

---

## 0. Decisioni vincolanti consolidate

1. **No `features` table.** `ArtifactKind="feature"` può esistere nei tipi, ma non implica tabella o repository v0.1.
2. **Hard delete cascade.** I file rimossi vengono cancellati da `files`; non esiste `deleted_at`.
3. **Foreign keys obbligatorie.** `openMemoryDb()` deve abilitare e testare `PRAGMA foreign_keys = ON`.
4. **`symbol_edges.source_file_id` obbligatorio.** Serve a implementare `replaceEdgesForFile(db, fileId, edges)` senza edge stale.
5. **Unresolved imports come warning.** Gli import/export non risolti non entrano in `symbol_edges`; diventano warning `unresolved_import`.
6. **Warnings lifecycle.** I warning per-file sono gestiti con `replaceWarningsForFile()` e dedupe tramite `fingerprint`.
7. **Routes/tests replace-per-file.** `routes.file_id` e `tests.file_id` sono obbligatori.
8. **PNG fallback.** `frames.png_path` è nullable; SVG e map JSON sono obbligatori.
9. **Snapshot su filesystem.** Nessuna tabella snapshot v0.1.
10. **Niente source dump.** Il DB può contenere signature/hash/summary brevi, mai codice sorgente esteso, embeddings o vettori.

---

## 1. Invarianti globali DB

1. Tutti i path persistiti sono relativi al project root, normalizzati POSIX e non assoluti.
2. I path generati sotto `.codex/memory/**` restano project-relative, per esempio `.codex/memory/current.svg`.
3. Nessuna tabella contiene path con backslash.
4. Nessuna tabella contiene blocchi estesi di codice sorgente.
5. Le scritture di index sono transazionali per file; le scritture di graph edge sono transazionali per file owner.
6. Un parse error su singolo file genera warning e non blocca l'index globale.
7. Errori DB/config/fs fatali producono `PmemError` secondo `04_FUNCTION_CONTRACTS.md`.
8. `project_state` contiene solo chiavi documentate qui.
9. Le colonne `*_json` contengono JSON compatto validato a livello TypeScript; non si richiede estensione SQLite JSON1.
10. `current.svg` e `current.map.json` sono primari; il DB salva solo metadati/path, non il contenuto SVG/map.
11. `current.png` è opzionale; assenza PNG non invalida memoria se SVG/map sono validi.
12. La v0.1 non usa cloud backend, embeddings, vector DB o LLM nella core path.

---

## 2. Apertura DB e schema lifecycle

`openMemoryDb(paths)` deve eseguire almeno:

```sql
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

`journal_mode = WAL` è consentito ma non obbligatorio. Se abilitato, `doctor` deve tollerare `memory.db-wal` e `memory.db-shm`.

`ensureSchema(db)` deve:

1. aprire una transazione;
2. creare tabelle mancanti con `CREATE TABLE IF NOT EXISTS`;
3. creare indici mancanti con `CREATE INDEX IF NOT EXISTS`;
4. scrivere `PRAGMA user_version = 1` se possibile;
5. scrivere `project_state.schema_version = "1"` se assente;
6. non cancellare tabelle/colonne/record esistenti;
7. non introdurre migrazioni distruttive;
8. segnalare `DB_ERROR` se lo schema esistente è incompatibile in modo non riparabile additivamente.

---

## 3. Schema SQL autoritativo v1

Codex deve implementare questo schema. Sono ammesse solo differenze cosmetiche che non cambiano nomi, vincoli, FK, nullability o semantica.

```sql
CREATE TABLE IF NOT EXISTS project_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT,
  summary TEXT,
  owns_json TEXT NOT NULL DEFAULT '[]',
  must_not_json TEXT NOT NULL DEFAULT '[]',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal', 'high')),
  updated_at TEXT NOT NULL,
  CHECK (root_path IS NULL OR root_path NOT LIKE '/%'),
  CHECK (root_path IS NULL OR root_path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  language TEXT CHECK (language IS NULL OR language IN ('typescript', 'javascript')),
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  hash TEXT NOT NULL CHECK (length(hash) > 0),
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  line_count INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  is_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_generated IN (0, 1)),
  last_indexed_at TEXT NOT NULL,
  CHECK (path NOT LIKE '/%'),
  CHECK (path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  fq_name TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  exported INTEGER NOT NULL DEFAULT 0 CHECK (exported IN (0, 1)),
  start_line INTEGER CHECK (start_line IS NULL OR start_line >= 1),
  end_line INTEGER CHECK (end_line IS NULL OR end_line >= 1),
  signature TEXT,
  signature_hash TEXT,
  body_hash TEXT,
  summary TEXT,
  UNIQUE(file_id, fq_name, kind),
  CHECK (end_line IS NULL OR start_line IS NULL OR end_line >= start_line)
);

CREATE TABLE IF NOT EXISTS symbol_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  from_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  to_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  edge_kind TEXT NOT NULL CHECK (edge_kind IN ('import', 'export', 'dependency')),
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  UNIQUE(source_file_id, from_symbol_id, to_symbol_id, edge_kind)
);

CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  handler_symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  UNIQUE(file_id, method, path),
  CHECK (path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  target_symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  test_kind TEXT NOT NULL DEFAULT 'unknown' CHECK (test_kind IN ('unit', 'integration', 'e2e', 'unknown')),
  summary TEXT
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warning_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  recommendation TEXT,
  source TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('parser', 'indexer', 'renderer', 'agent', 'mcp', 'config', 'inferred')),
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  left_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  right_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  left_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  right_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  similarity REAL NOT NULL CHECK (similarity >= 0.0 AND similarity <= 1.0),
  reason TEXT,
  created_at TEXT NOT NULL,
  CHECK (left_symbol_id IS NOT NULL OR left_file_id IS NOT NULL),
  CHECK (right_symbol_id IS NOT NULL OR right_file_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY CHECK (id IN ('current', 'overview', 'modules', 'duplicates', 'risks')),
  frame_type TEXT NOT NULL CHECK (frame_type IN ('current', 'overview', 'module_map', 'duplicate_map', 'risk_map')),
  title TEXT NOT NULL,
  svg_path TEXT NOT NULL,
  png_path TEXT,
  map_path TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  CHECK (svg_path NOT LIKE '/%'),
  CHECK (svg_path NOT LIKE '%\%'),
  CHECK (map_path NOT LIKE '/%'),
  CHECK (map_path NOT LIKE '%\%'),
  CHECK (png_path IS NULL OR png_path NOT LIKE '/%'),
  CHECK (png_path IS NULL OR png_path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent TEXT NOT NULL,
  agent TEXT NOT NULL CHECK (agent IN ('retrieval', 'duplicate', 'drift', 'architecture', 'render')),
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 3.1 Tabelle vietate in schema v1

| Tabella | Motivo |
|---|---|
| `features` | fuori core path v0.1; nessuna funzione la popola |
| `file_edges` | non necessaria: unresolved import = warning |
| `embeddings`, `vectors` | scope creep; niente vector DB |
| `source_chunks` | niente sorgente estesa nel DB |
| `snapshot_records` | snapshot su filesystem |
| `remote_sync`, `team_memory` | niente backend cloud |

Se una di queste appare in un DB legacy, `doctor` deve segnalarla ma non cancellarla automaticamente.

---

## 4. Indici autoritativi v1

```sql
CREATE INDEX IF NOT EXISTS idx_files_module_id ON files(module_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);

CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_fq_name ON symbols(fq_name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);

CREATE INDEX IF NOT EXISTS idx_symbol_edges_source_file_id ON symbol_edges(source_file_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_from_symbol_id ON symbol_edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_to_symbol_id ON symbol_edges(to_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_kind ON symbol_edges(edge_kind);

CREATE INDEX IF NOT EXISTS idx_routes_file_id ON routes(file_id);
CREATE INDEX IF NOT EXISTS idx_routes_module_id ON routes(module_id);
CREATE INDEX IF NOT EXISTS idx_routes_method_path ON routes(method, path);

CREATE INDEX IF NOT EXISTS idx_tests_file_id ON tests(file_id);
CREATE INDEX IF NOT EXISTS idx_tests_target_symbol_id ON tests(target_symbol_id);

CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(resolved_at, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_warnings_file_source ON warnings(file_id, source, resolved_at);
CREATE INDEX IF NOT EXISTS idx_warnings_type ON warnings(warning_type);
CREATE INDEX IF NOT EXISTS idx_warnings_module_id ON warnings(module_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_active_file_dedupe
  ON warnings(file_id, source, fingerprint)
  WHERE file_id IS NOT NULL AND resolved_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_active_global_dedupe
  ON warnings(source, fingerprint)
  WHERE file_id IS NULL AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_similarity ON duplicate_candidates(similarity DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_kind ON duplicate_candidates(kind);

CREATE INDEX IF NOT EXISTS idx_frames_generated_at ON frames(generated_at);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_created_at ON retrieval_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_agent ON retrieval_logs(agent);
```

Nessun indice v0.1 deve richiedere estensioni SQLite esterne.

---

## 5. `project_state` keys

| Key | Valore | Scrive | Legge | Default se mancante |
|---|---|---|---|---|
| `schema_version` | `1` | `ensureSchema` | `doctor`, `head`, runtime | `null` |
| `project_name` | nome progetto | `init`, config loader | `head`, renderer, MCP | `null` |
| `memory_status` | `not_initialized`/`initializing`/`fresh`/`stale`/`dirty`/`error` | init/index/render/refresh | tutti | `not_initialized` |
| `memory_dirty` | `true`/`false` | index/refresh | head/doctor | `false` |
| `dirty_reason` | stringa compatta | index/refresh | head/doctor | `""` |
| `last_indexed_at` | ISO timestamp | index/refresh | head/doctor/MCP | `null` |
| `last_rendered_at` | ISO timestamp | render/refresh | head/frame/MCP | `null` |
| `config_hash` | hash config canonico | init/index/doctor | changed-only | `null` -> reindex |
| `indexer_version` | versione indexer | index/doctor | changed-only | `null` -> reindex |
| `renderer_version` | versione renderer | render/doctor | render changed-only | `null` -> render |
| `last_error` | `ErrorPayload` JSON compatto oppure stringa vuota | error boundary | doctor/head | `null` |

Chiavi non documentate sono vietate nella v0.1.

---

## 6. Mapping record ↔ tipi canonici di `04`

| Tipo `04` | Tabella | Mapping |
|---|---|---|
| `ProjectState` | `project_state` | key-value normalizzato in object runtime |
| `ModuleRecord` | `modules` | array in `owns_json`, `must_not_json`, `dependencies_json` |
| `IndexedFileRecord` | `files` | `is_test`/`is_generated` DB `0/1` ↔ runtime boolean |
| `SymbolRecord` | `symbols` | `exported` DB `0/1` ↔ runtime boolean |
| `ResolvedSymbolEdgeInput` | input `replaceEdgesForFile` | non contiene `sourceFileId`; lo store lo riceve dal parametro `fileId` |
| `SymbolEdgeRecord` | `symbol_edges` | contiene `sourceFileId` quando letto dal DB |
| `RouteRecordInput` | input `replaceRoutesForFile`/indexer | non contiene `fileId`; lo store lo riceve dal parametro `fileId` |
| `RouteRecord` | `routes` | contiene `fileId` quando letto dal DB |
| `TestLinkRecord` | `tests` | popolata solo con `replaceTestLinksForFile()` |
| `WarningRecordInput`/`WarningRecord` | `warnings` | `fingerprint` è store-owned dedupe key |
| `FrameRecord` | `frames` | `png_path` nullable; `svg_path`/`map_path` obbligatori |
| `DuplicateCandidateRecord` | `duplicate_candidates` | cache locale per duplicate guard; `DuplicateCandidate` è output agente compatto |

---

## 7. Repository store richiesti

| Repository | File | Funzioni vincolanti | Responsabilità |
|---|---|---|---|
| SQLiteStore | `src/store/sqlite.ts` | `openMemoryDb`, `ensureSchema`, `withTransaction` | connessione, PRAGMA, schema, transaction boundary |
| ProjectStateRepository | `src/store/project-state-repository.ts` | `getProjectState`, `setProjectStateValue`, `markMemoryDirty`, `markMemoryFresh` | status, dirty flag, timestamps, last error |
| FileRepository | `src/store/file-repository.ts` | `upsertFileRecord`, `listFiles`, `getFileByPath`, `removeFileRecordCascade` | file indicizzati e hard delete cascade |
| SymbolRepository | `src/store/symbol-repository.ts` | `replaceSymbolsForFile`, `searchSymbols`, `getSymbolById` | simboli correnti per file |
| EdgeRepository | `src/store/edge-repository.ts` | `replaceEdgesForFile`, `listEdgesForGraph` | edge risolti per file owner |
| ModuleRepository | `src/store/module-repository.ts` | `upsertModule`, `listModules`, `inferModuleForPath` | moduli e ownership |
| RouteRepository | `src/store/route-repository.ts` | `replaceRoutesForFile`, `listRoutes` | route derivate da file |
| TestRepository | `src/store/test-repository.ts` | `replaceTestLinksForFile`, `listTestLinksForSymbol` | test adjacency |
| WarningRepository | `src/store/warning-repository.ts` | `replaceWarningsForFile`, `resolveWarningsForFile`, `addWarning`, `listActiveWarnings` | warning attivi/risolti e dedupe |
| FrameRepository | `src/store/frame-repository.ts` | `upsertFrame`, `getFrame`, `listFrames` | metadati frame visuali |
| DuplicateRepository | `src/store/duplicate-repository.ts` | `replaceDuplicateCandidates`, `listDuplicateCandidates` | duplicate guard cache |
| RetrievalLogRepository | `src/store/retrieval-log-repository.ts` | `insertRetrievalLog`, `listRecentRetrievalLogs` | log compatti micro-agent |

---

## 8. Transaction recipes

### 8.1 File nuovo o modificato

Per ogni file changed, `indexChangedFiles(ctx)` deve eseguire una transazione logica equivalente a:

```text
1. upsertFileRecord(db, file)
2. replaceSymbolsForFile(db, fileId, symbols)
3. replaceRoutesForFile(db, fileId, routes)
4. replaceTestLinksForFile(db, fileId, links)
5. replaceEdgesForFile(db, fileId, resolvedEdges)
6. replaceWarningsForFile(db, fileId, "parser"|"indexer", warnings)
7. update files.last_indexed_at
```

Se il parser fallisce per quel file:

- non inserire simboli parziali non validati;
- inserire warning `parse_error` via `replaceWarningsForFile()`;
- continuare con gli altri file se DB/config/fs restano validi.

### 8.2 File cancellato

`removeFileRecordCascade(db, path)` deve essere:

```text
BEGIN
  SELECT id FROM files WHERE path = ?
  if missing -> COMMIT no-op
  DELETE FROM files WHERE path = ?
COMMIT
```

Effetti obbligatori:

- `symbols` del file cancellati;
- `symbol_edges` con `source_file_id` del file cancellati;
- `symbol_edges` verso/da simboli cancellati rimossi via FK;
- `routes` del file cancellate;
- `tests` del file cancellati;
- `warnings` file-scoped cancellati;
- `duplicate_candidates` collegati al file o ai simboli rimossi cancellati;
- `frames` e `retrieval_logs` non cancellati automaticamente.

La chiamata ripetuta sullo stesso path è no-op.

### 8.3 Symbol replace

`replaceSymbolsForFile(db, fileId, symbols)` deve cancellare i vecchi simboli del file e inserire il set corrente ordinato stabilmente. La cancellazione dei simboli può eliminare edge/duplicate candidate collegati tramite FK; per questo `replaceEdgesForFile()` deve essere eseguito dopo il replace simboli.

### 8.4 Edge replace

`replaceEdgesForFile(db, fileId, edges)` deve:

```text
BEGIN
  DELETE FROM symbol_edges WHERE source_file_id = fileId
  INSERT only resolved edges with source_file_id = fileId
COMMIT
```

Invarianti:

- `from_symbol_id` e `to_symbol_id` sono obbligatori e devono puntare a simboli esistenti;
- nessun unresolved import viene inserito;
- `confidence` è sempre `0.0 <= confidence <= 1.0`;
- edge duplicati sono impediti da unique constraint.

### 8.5 Routes/tests replace

`replaceRoutesForFile()` e `replaceTestLinksForFile()` cancellano il set precedente del file e inseriscono il set corrente, ordinato stabilmente e deduplicato in memoria. Target test non risolti usano `target_symbol_id = NULL` o generano warning `test_target_unresolved`, senza fatal error.

### 8.6 Warning replace

`replaceWarningsForFile(db, fileId, source, warnings)` deve:

1. normalizzare ogni warning;
2. calcolare `fingerprint` stabile;
3. deduplicare il batch in memoria;
4. risolvere (`resolved_at = nowIso()`) warning attivi precedenti per `file_id + source` non più presenti;
5. aggiornare warning attivi ancora presenti senza cambiare `created_at`;
6. inserire warning nuovi con `resolved_at = NULL`.

Fingerprint minimo:

```text
sha256(warning_type + "\n" + source + "\n" + file_path + "\n" + coalesce(symbol_fq_name, "") + "\n" + normalized_message)
```

`addWarning()` è riservato a warning globali/run-scoped, come `png_export_failed` e `legacy_table_features`.

---

## 9. Changed-only rules

Un file va reindicizzato se:

- non esiste in `files`;
- hash corrente diverso da `files.hash`;
- config include/exclude o module hints sono cambiati;
- `project_state.config_hash` è assente o diverso;
- `project_state.indexer_version` è assente o diverso;
- il file è stato cancellato o è uscito dallo scope di scan.

Un file non va reindicizzato se:

- path e hash sono invariati;
- appartiene a `.codex/memory/**`;
- è escluso dalla config;
- è lingua fuori v0.1;
- supera `scan.maxFileBytes` senza override.

Algoritmo minimo:

```text
1. scan filesystem con include/exclude stabili
2. calcola hash candidati
3. loaded = files DB
4. deleted = loaded.path - scanned.path
5. changed = scanned con path assente o hash diverso
6. for deleted path sorted asc: removeFileRecordCascade(db, path)
7. for changed file sorted asc: transaction recipe 8.1
8. se run globale ok: aggiorna last_indexed_at, config_hash, indexer_version
```

---

## 10. Warning type canonici v0.1

| `warning_type` | Source tipica | Severity default | Quando |
|---|---|---|---|
| `parse_error` | `parser` | `warning` | file TS/JS non parsabile |
| `unsupported_language` | `indexer` | `info` | file fuori TS/JS |
| `file_too_large` | `indexer` | `warning` | file supera `maxFileBytes` |
| `unresolved_import` | `indexer` | `warning` | import/export non risolto |
| `dynamic_route` | `indexer` | `info` | route NestJS non literal |
| `test_target_unresolved` | `indexer` | `info` | target test non inferibile |
| `png_export_failed` | `renderer` | `warning` | PNG non generato ma SVG/map validi |
| `frame_stale` | `renderer` | `info` | frame non aggiornato rispetto a source hash |
| `duplicate_high_risk` | `agent` | `warning` | duplicate guard trova match alto |
| `config_deprecated_key` | `config` | `info` | chiave config ignorata/legacy |
| `legacy_table_features` | `config` | `info` | DB legacy contiene tabella fuori v0.1 |

Warning non devono contenere stack trace lunghi, codice sorgente o path assoluti.

---

## 11. JSON columns contract

| Colonna | Shape v0.1 | Vincoli |
|---|---|---|
| `modules.owns_json` | `string[]` | pattern/path POSIX |
| `modules.must_not_json` | `string[]` | regole brevi |
| `modules.dependencies_json` | `string[]` | module id |
| `retrieval_logs.output_json` | output agent compatto | JSON validabile, niente sorgente |

Regole comuni:

- JSON compatto;
- proprietà ordinate stabilmente quando prodotte dal plugin;
- invalid JSON letto dal DB -> `DB_ERROR`, salvo recovery esplicitamente documentato;
- target size < 64KB per record v0.1.

---

## 12. Frames e PNG fallback

Il renderer scrive file su filesystem:

```text
.codex/memory/current.svg
.codex/memory/current.map.json
.codex/memory/current.png              optional
.codex/memory/frames/*.svg
.codex/memory/frames/*.map.json
.codex/memory/frames/*.png             optional
.codex/memory/generated/*.json
```

Il DB salva solo record `frames`.

Regole:

- `svg_path` e `map_path` sono obbligatori e puntano sotto `.codex/memory/**`;
- `png_path` può essere `NULL`;
- PNG failure genera warning `png_export_failed` ma non invalida frame;
- `source_hash` esclude timestamp e campi volatili;
- upsert frame avviene solo dopo scrittura atomica valida di SVG/map.

---

## 13. Snapshot v0.1

Gli snapshot sono file JSON, non tabelle SQLite:

```text
.codex/memory/snapshots/latest.snapshot.json
.codex/memory/snapshots/previous.snapshot.json
```

Snapshot minimo:

```json
{
  "version": 1,
  "createdAt": "2026-06-09T00:00:00.000Z",
  "schemaVersion": "1",
  "configHash": "sha256:...",
  "files": [{ "path": "src/access/access.service.ts", "hash": "sha256:...", "moduleId": "access" }],
  "symbols": [{ "fqName": "AccessService.canOpen", "kind": "method", "filePath": "src/access/access.service.ts" }],
  "warnings": [{ "warningType": "unresolved_import", "severity": "warning", "filePath": "src/access/access.service.ts", "fingerprint": "sha256:..." }],
  "frames": [{ "id": "current", "svgPath": ".codex/memory/current.svg", "pngPath": null, "mapPath": ".codex/memory/current.map.json", "sourceHash": "sha256:..." }]
}
```

Invarianti:

- array ordinati stabilmente;
- niente codice sorgente;
- niente path assoluti;
- `createdAt` ammesso ma escluso da hash deterministici;
- `pngPath` nullable.

Diff minimo v0.1:

```text
addedFiles[]
removedFiles[]
changedFiles[]
addedSymbols[]
removedSymbols[]
newWarnings[]
resolvedWarnings[]
frameSourceHashChanged[]
```

Snapshot mancanti -> diff vuoto con warning, non fatal error.

---

## 14. Errori dati

| Caso | Comportamento |
|---|---|
| DB assente | `head` restituisce `not_initialized`; `init`/`ensureSchema` crea DB |
| `foreign_keys` off | `openMemoryDb()` abilita; `doctor` segnala se off |
| schema mancante | `ensureSchema` crea tabelle/indici mancanti |
| schema incompatibile | `DB_ERROR`, nessun repair distruttivo |
| `schema_version > 1` | v0.1 segnala incompatibilità, no downgrade |
| config invalida | `CONFIG_ERROR`, nessun index/render |
| file non parsabile | warning `parse_error`, index continua |
| import non risolto | warning `unresolved_import`, nessun edge |
| route dinamica | warning `dynamic_route`, route non persistita se non deterministica |
| target test non risolto | warning `test_target_unresolved` o target null |
| file cancellato | hard delete cascade |
| warning duplicato attivo | impedito da unique partial index + replace lifecycle |
| PNG export fallito | warning `png_export_failed`; `png_path=NULL` |
| DB corrotto | `doctor` segnala; nessuna cancellazione automatica |
| tabella legacy `features` | warning/info `legacy_table_features`; nessun drop automatico |

---

## 15. Test minimi obbligatori

| Area | Test | Acceptance |
|---|---|---|
| Schema | `ensureSchema()` su DB vuoto | crea tabelle/indici v1 e `schema_version=1` |
| No features | introspezione `sqlite_master` | tabella `features` assente |
| FK | `PRAGMA foreign_keys` | ritorna `1` |
| Idempotenza | `ensureSchema()` due volte | nessun errore/doppione |
| File cascade | delete file con dati dipendenti | symbols/routes/tests/warnings/edges/candidates rimossi |
| Changed-only delete | file rimosso da fixture | nessun path stale in retrieval/list |
| Symbol replace | simbolo rimosso dal file | vecchio simbolo assente |
| Edge replace | import rimosso | edge stale assente per `source_file_id` |
| Unresolved import | import mancante | warning attivo, zero edge |
| Route replace | route cambiata | solo route nuova presente |
| Test replace | re-index test file | nessun duplicato |
| Warning dedupe | due run identici | active warnings invariati |
| Warning resolve | warning sparisce | `resolved_at` valorizzato |
| Frames | render senza PNG | `png_path=NULL`, SVG/map registrati |
| Snapshot | snapshot da DB | JSON stabile, no codice, path relativi |
| DB corrupt | file DB non SQLite | `doctor` segnala `DB_ERROR`, no delete automatico |

---

## 16. Acceptance criteria data model

La parte SQLite v0.1 è accettabile solo se:

1. `ensureSchema()` crea esattamente le tabelle core documentate, senza `features`, vector o source chunk tables.
2. `openMemoryDb()` abilita FK e i test lo verificano.
3. `removeFileRecordCascade()` elimina tutti i dati stale collegati a file cancellati.
4. `replaceEdgesForFile()` usa `source_file_id` e non lascia edge obsoleti.
5. `replaceWarningsForFile()` evita duplicati attivi e risolve warning non più presenti.
6. Un unresolved import produce warning e non produce `symbol_edges`.
7. Route/test sono replace-per-file e idempotenti.
8. `frames.png_path = NULL` è valido se SVG/map esistono.
9. Tutti i path persistiti sono POSIX relativi e non assoluti.
10. Snapshot/diff non contengono codice sorgente.
11. Tutti gli errori dati usano `PmemErrorCode` coerente con `04_FUNCTION_CONTRACTS.md`.

---

## 17. Allineamenti consolidati

| Documento | Vincolo data model recepito |
|---|---|
| `06_CLI_CONTRACTS.md` | `doctor` verifica FK on, schema v1, assenza `features`, PNG nullable |
| `07_MCP_TOOL_CONTRACTS.md` | `memory.frame` e `visualFrame` hanno `png: string \| null` |
| `08_RENDERER_VISUAL_CONTRACT.md` | SVG/map obbligatori, PNG best-effort, frame registry con `png_path=NULL` |
| `09_AGENTS_AND_HOOKS_CONTRACT.md` | retrieval/duplicate non leggono `features`; warning lifecycle dedupe |
| `10_TEST_PLAN_AND_ACCEPTANCE.md` | PNG non obbligatorio se warning `png_export_failed` presente |
| `11_CODEX_IMPLEMENTATION_PROMPTS.md` | prompt P2/P3 vietano `features`, soft delete, unresolved edge testuali |
| `12_DEMO_SCENARIO.md` | demo verifica PNG nullable e hard delete cascade |
| `13_OPEN_ITEMS_AND_GUARDS.md` | guardrail bloccano tabelle/comportamenti fuori schema v1 |

---

## 18. Note per agente autonomo

Punti dove un agente tende a improvvisare e deve invece seguire questo documento:

1. `criticalRules` vive in `project-memory.config.json`, non in una tabella DB dedicata. Il renderer/agent la leggono dalla config e la portano nel graph/output quando serve.
2. `ResolvedSymbolEdgeInput` e `RouteRecordInput` sono input di replace per-file; il `file_id/source_file_id` viene applicato dallo store. Le record lette dal DB (`SymbolEdgeRecord`, `RouteRecord`) includono invece gli id owner.
3. `replaceWarningsForFile` è l'unico percorso per warning da re-index per file; `addWarning` è solo per warning globali/run-level.
4. Snapshot e diff non creano tabelle: usare file JSON sotto `snapshots/`.
5. Se serve una query non prevista, creare repository read-only mirato e documentarlo prima in `04`; non aggiungere tool SQL generico.

Acceptance autonomous-ready dati:

```text
- schema.sql eseguibile da zero
- PRAGMA user_version = 1
- PRAGMA foreign_keys = ON su ogni connessione
- introspezione conferma assenza features/vector/source_chunks
- cancellazione file rimuove simboli, edge, route, test link, warning e candidate collegati
- due index identici non duplicano warning
```
