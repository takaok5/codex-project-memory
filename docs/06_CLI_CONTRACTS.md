# Codex Project Memory Plugin — contratti CLI `pmem` v0.1

**Stato:** contratto CLI raffinato global-pass5 autonomous-ready, allineato a funzioni, data model, MCP, renderer, agenti/lifecycle e test.
**Marker:** `PMEM06-GLOBAL-PASS5-20260613`.  
**Binario:** `pmem` oppure `node dist/cli/pmem.js`.  
**Autorità:** `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` resta fonte operativa primaria; `04_FUNCTION_CONTRACTS.md` vincola tipi/funzioni; questo documento vincola comandi CLI, flag, output, exit code e comportamento utente.

---

## 0. Decisioni vincolanti consolidate

1. Il CLI usa `CliResult<T>` e `ErrorPayload` esattamente come definiti in `04_FUNCTION_CONTRACTS.md`.
2. L'enum errori è `PmemErrorCode` unico: `VALIDATION_ERROR`, `STATE_ERROR`, `FRAME_NOT_FOUND` e `TEMPLATE_ERROR` sono codici validi anche in CLI.
3. Tutti gli output JSON contengono solo path relativi POSIX; mai path assoluti.
4. `current.svg` e `current.map.json` sono primari; `current.png` e `frames/*.png` sono opzionali e rappresentati come `null` quando non disponibili.
5. `pmem doctor` deve verificare `PRAGMA foreign_keys=ON`, `PRAGMA user_version`, tabelle obbligatorie, assenza di tabelle vietate core come `features`, e stato frame SVG/map/PNG.
6. `pmem render` e `pmem refresh` non falliscono se export PNG fallisce: ritornano warning `png_export_failed`.
7. `validate` e `summarize` non sono comandi v0.1: non devono essere implementati né documentati come opzionali.
8. `pmem agents install/list` sono supportati ma restano fuori dalla core path runtime: installano/leggono template subagenti opzionali e non sono richiesti da index/query/render.
9. `pmem refresh` è changed-only per default; non introduce un full-scan implicito da comandi ad alto livello.
10. Nessun comando CLI modifica codice sorgente del repository target nella v0.1.

---

## 1. Comandi supportati

### 1.1 Core commands obbligatori

```text
pmem init
pmem doctor
pmem scan
pmem index
pmem render
pmem head
pmem query "<intent>"
pmem duplicates --kind <kind> "<intent>"
pmem refresh
pmem frame <frame>
pmem diff
```

### 1.2 Comandi subagenti opzionali ma contrattualizzati

```text
pmem agents install --scope project
pmem agents list
```

Questi comandi sono disponibili in v0.1, ma non fanno parte della core path. La core path deve funzionare anche se i subagenti Codex non sono mai installati.

### 1.3 Comandi vietati in v0.1

```text
pmem validate
pmem summarize
pmem server
pmem sync
pmem login
pmem embeddings
pmem cloud
pmem migrate --destructive
```

Codex non deve implementarli. Qualsiasi aggiunta richiede aggiornamento preventivo di `01`, `04`, `06`, `07`, `10` e `13`.

---

## 1.4 Matrice decisionale per agente autonomo

Un agente deve scegliere i comandi così, senza inventare workflow alternativi:

| Situazione | Comando | Note |
|---|---|---|
| Non sai se la memoria esiste | `pmem head --json` | deve funzionare anche pre-init |
| Devi creare memoria nel repo | `pmem init --json` | idempotente |
| Devi diagnosticare setup | `pmem doctor --json` | read-only, non ripara automaticamente |
| Devi vedere cosa verrà indicizzato | `pmem scan --json` | non scrive DB |
| Devi aggiornare memoria strutturale | `pmem index --json` o `pmem index --changed --json` | changed-only quando possibile |
| Devi produrre vista visuale | `pmem render --json` | SVG/map obbligatori, PNG nullable |
| Devi recuperare contesto per task | `pmem query "<intent>" --json` | output compatto, niente codice |
| Devi creare service/controller/dto/table/module/etc. | `pmem duplicates --kind <kind> "<intent>" --json` | obbligatorio prima di creare artefatti |
| Dopo modifiche architetturali | `pmem refresh --changed-only --json` | default render=true |
| Devi aprire frame | `pmem frame current --json` | non renderizza implicitamente |
| Devi capire cosa è cambiato | `pmem diff --json` | nessun codice sorgente |
| Devi installare subagenti opzionali | `pmem agents install --scope project --json` | no overwrite senza `--force` |

Se un comando fallisce con `NOT_INITIALIZED`, il prossimo comando suggerito è sempre `pmem init --json`, non uno scan manuale.

---

## 2. Regole globali CLI

### 2.1 Opzioni comuni

Ogni comando supporta:

```text
--json
--help
```

`--json` è obbligatorio per uso da MCP wrapper o automazioni. In modalità `--json`, stdout contiene un solo JSON compatto e nessuna prosa.

La modalità human-readable è ammessa solo per terminale interattivo e deve restare breve.

### 2.2 Output JSON canonico

Ogni comando in modalità JSON deve restituire:

```ts
interface CliResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
  warnings?: string[];
}
```

Regole:

- `ok=true` richiede `data` valorizzato.
- `ok=false` richiede `error` valorizzato.
- `warnings` è sempre presente negli esempi e deve essere presente nell'implementazione come array, anche vuoto.
- `error` non deve contenere stack trace.
- `details` non deve contenere path assoluti.
- Non sono ammessi output misti JSON + testo libero.

### 2.3 Exit code

| Exit code | Significato | Casi |
|---:|---|---|
| `0` | Successo | `ok=true`, inclusi warning non fatali |
| `1` | Errore input/operativo | `INVALID_INPUT`, `VALIDATION_ERROR`, `ALREADY_EXISTS`, `CONFIG_ERROR`, `FS_ERROR`, `DB_ERROR`, `INDEX_ERROR`, `RENDER_ERROR`, `AGENT_ERROR`, `MCP_ERROR`, `SAFETY_ERROR`, `STATE_ERROR`, `TEMPLATE_ERROR`, `INTERNAL_ERROR` |
| `2` | Prerequisito o risorsa memoria mancante | `NOT_INITIALIZED`, `FRAME_NOT_FOUND`, DB/config/frame richiesti ma assenti |

`pmem doctor` e `pmem head` sono eccezioni: devono poter descrivere `not_initialized` con `ok=true` e exit code `0`, salvo errore CLI interno.

### 2.4 Stdout/stderr

| Modalità | Successo | Errore |
|---|---|---|
| `--json` | JSON compatto su stdout | JSON compatto su stdout |
| human | testo breve su stdout | messaggio breve su stderr |

Il lifecycle supportato deve usare MCP tools o CLI `--json`, mai output human-readable per automazioni.

### 2.5 Path e contenuti

In ogni output:

- i path devono essere project-relative POSIX;
- i path sotto memoria devono iniziare con `.codex/memory/`;
- i path sotto agenti devono iniziare con `.codex/agents/`;
- non devono comparire path assoluti, backslash Windows o `..` normalizzati in output;
- non devono comparire contenuti sorgente estesi;
- signature e summary brevi sono ammessi solo se previsti dal `ContextPack`.

### 2.6 Precondizioni per comando

| Comando | Funziona prima di `init` | Richiede config valida | Richiede DB valido | Richiede frame esistente |
|---|---:|---:|---:|---:|
| `init` | sì | no | no | no |
| `doctor` | sì | no | no | no |
| `head` | sì | no | no | no |
| `scan` | no | sì | no | no |
| `index` | no | sì | sì | no |
| `render` | no | sì | sì | no |
| `query` | no | sì | sì | no |
| `duplicates` | no | sì | sì | no |
| `refresh` | no | sì | sì | no |
| `frame` | no | sì | sì | sì |
| `diff` | no | sì | sì | no |
| `agents install` | sì | no | no | no |
| `agents list` | sì | no | no | no |

---

## 3. Tipi condivisi CLI

Questi tipi devono vivere in `src/cli/types.ts` oppure essere importati da `src/shared/types.ts`. Le shape semantiche non devono divergere dai tipi canonici di `04_FUNCTION_CONTRACTS.md`.

```ts
type CliPath = string;
type CliCheckStatus = "ok" | "warning" | "error" | "skipped";
type OverallDoctorStatus = "ok" | "warning" | "error" | "not_initialized";

type FrameName = "current" | "overview" | "modules" | "duplicates" | "risks";

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

interface CommonCliOptions {
  json: boolean;
  cwd: string;
  verbose?: boolean;
}

interface CliCheck {
  id: string;
  status: CliCheckStatus;
  message: string;
  details?: JsonObject;
}

interface CliFramePath {
  frame: FrameName;
  svg: CliPath;
  png: CliPath | null;
  map: CliPath;
  sourceHash?: string;
  generatedAt?: string;
}
```

---

## 4. Contratti comando

## 4.1 `pmem init`

### Signature

```text
pmem init [--force] [--json]
```

### Input

| Campo | Tipo | Default | Regola |
|---|---|---:|---|
| `cwd` | path assoluto runtime | process cwd | risolto come project root via runtime |
| `--force` | boolean | `false` | consente rigenerazione config/template memoria generati, mai cancellazione sorgenti |
| `--json` | boolean | `false` | output JSON compatto |

### Output JSON

```json
{
  "ok": true,
  "data": {
    "status": "fresh",
    "memoryRoot": ".codex/memory",
    "config": ".codex/memory/project-memory.config.json",
    "db": ".codex/memory/memory.db",
    "schemaVersion": 1,
    "created": [
      ".codex/memory",
      ".codex/memory/frames",
      ".codex/memory/generated",
      ".codex/memory/snapshots",
      ".codex/memory/cache",
      ".codex/memory/logs",
      ".codex/memory/project-memory.config.json",
      ".codex/memory/memory.db"
    ],
    "skipped": []
  },
  "warnings": []
}
```

### Side effects

- Crea `.codex/memory/**`.
- Scrive config default se assente o se `--force` lo permette.
- Crea/apre `.codex/memory/memory.db`.
- Esegue `ensureSchema()` e imposta schema v1.
- Inizializza `project_state` con `schema_version=1` e status coerente.

### Invarianti

- Idempotente: un secondo `pmem init` su memoria valida ritorna `ok=true` con `created=[]` e `skipped` valorizzato.
- Non modifica codice sorgente.
- Non cancella DB esistente.
- Non crea tabelle vietate, inclusa `features`.
- Abilita e verifica `PRAGMA foreign_keys=ON` tramite `openMemoryDb()`.

### Error handling

| Caso | Codice |
|---|---|
| project root non scrivibile | `FS_ERROR` |
| config esistente invalida e non rigenerabile | `CONFIG_ERROR` |
| schema DB incompatibile non riparabile additivamente | `DB_ERROR` |
| path safety violata | `SAFETY_ERROR` |

### Test minimi

- init su directory vuota;
- init ripetuto senza `--force`;
- init con config esistente valida;
- init con directory `.codex/memory` parziale;
- verifica `PRAGMA foreign_keys=ON`;
- verifica assenza tabella `features`.

### Acceptance

`pmem init --json` è accettato solo se crea config, DB v1, directory memoria e ritorna solo path relativi POSIX.

---

## 4.2 `pmem doctor`

### Signature

```text
pmem doctor [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "overallStatus": "ok",
    "memoryRoot": ".codex/memory",
    "state": {
      "status": "fresh",
      "schemaVersion": "1",
      "lastIndexedAt": "2026-06-09T00:00:00.000Z",
      "lastRenderedAt": "2026-06-09T00:00:00.000Z",
      "memoryDirty": false,
      "dirtyReason": "",
      "lastError": null
    },
    "checks": [
      { "id": "memory_root", "status": "ok", "message": ".codex/memory exists" },
      { "id": "config", "status": "ok", "message": "config schemaVersion=1" },
      { "id": "sqlite_open", "status": "ok", "message": "memory.db open" },
      { "id": "sqlite_foreign_keys", "status": "ok", "message": "PRAGMA foreign_keys=ON" },
      { "id": "sqlite_user_version", "status": "ok", "message": "PRAGMA user_version=1" },
      { "id": "sqlite_forbidden_tables", "status": "ok", "message": "no forbidden v0.1 tables" },
      { "id": "frame_svg", "status": "ok", "message": "current.svg present" },
      { "id": "frame_map", "status": "ok", "message": "current.map.json present" },
      { "id": "frame_png", "status": "skipped", "message": "current.png is optional" }
    ],
    "schema": {
      "userVersion": 1,
      "schemaVersion": "1",
      "foreignKeysEnabled": true,
      "requiredTablesPresent": true,
      "forbiddenTables": []
    },
    "frames": {
      "currentSvg": ".codex/memory/current.svg",
      "currentMap": ".codex/memory/current.map.json",
      "currentPng": null,
      "pngOptional": true
    },
    "capabilities": {
      "diagnostics": {
        "status": "ok",
        "hardGate": false,
        "message": "0 diagnostics stored",
        "diagnosticsStored": 0,
        "degradedLanguages": [],
        "failedTools": []
      }
    }
  },
  "warnings": []
}
```

### Side effects

Nessuno. `doctor` non chiama `ensureSchema()` in modo mutativo. Può aprire il DB in lettura/diagnostica, ma non deve correggere automaticamente lo stato.

### Invarianti

- Funziona prima di `init`.
- Non fallisce solo perché `current.png` manca.
- Segnala `features` come tabella vietata legacy se presente, ma non la elimina.
- Non cancella DB corrotto.
- Non scrive config o frame.
- `capabilities.diagnostics.status="degraded"` segnala solo degradazione non bloccante del layer compiler-assisted; non implica corruzione SQLite, schema invalido o fallimento della memoria core.

### Error handling

`doctor` preferisce `ok=true` con `overallStatus="error"` e check dettagliati. Usa `ok=false` solo per errori CLI non diagnosticabili, per esempio input invalido o eccezione interna.

| Caso | Risultato |
|---|---|
| memoria assente | `ok=true`, `overallStatus="not_initialized"` |
| config invalida | `ok=true`, check `config:error` |
| DB mancante | `ok=true`, check `sqlite_open:error` |
| DB corrotto | `ok=true`, check `sqlite_open:error`, dettagli `DB_ERROR` |
| `features` presente | `ok=true`, check `sqlite_forbidden_tables:warning` |
| PNG mancante | `ok=true`, check `frame_png:skipped` o `warning`, mai errore |
| analyzer compiler-assisted mancante/fallito | `ok=true`, `capabilities.diagnostics.status="degraded"`, `hardGate=false` |

### Test minimi

- doctor prima di init;
- doctor con DB assente;
- doctor con config invalida;
- doctor con DB corrotto;
- doctor con `features` legacy;
- doctor con SVG/map presenti e PNG assente.

### Acceptance

`pmem doctor --json` deve essere sicuro da eseguire in qualunque stato del repository e non deve avere side effect.

---

## 4.3 `pmem scan`

### Signature

```text
pmem scan [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "projectRootMethod": "git",
    "include": ["src/**/*.ts", "src/**/*.js"],
    "exclude": ["node_modules/**", "dist/**", ".codex/memory/**"],
    "summary": {
      "included": 42,
      "excluded": 7,
      "tooLarge": 1,
      "typescript": 40,
      "javascript": 2
    },
    "files": ["src/app/access.service.ts", "src/app/access.controller.ts"]
  },
  "warnings": []
}
```

### Side effects

Nessuno. Non scrive DB, stato, log o cache.

### Invarianti

- Richiede config valida.
- Rispetta `scan.include`, `scan.exclude`, `scan.languages`, `scan.maxFileBytes`.
- Esclude sempre `.codex/memory/**`, anche se configurazione include pattern ampio.
- Ordina i file in modo stabile per path POSIX ascendente.
- Non legge né stampa contenuto file.

### Error handling

| Caso | Codice |
|---|---|
| memoria non inizializzata | `NOT_INITIALIZED` |
| config invalida | `CONFIG_ERROR` |
| glob/pattern invalido | `VALIDATION_ERROR` |
| filesystem non leggibile | `FS_ERROR` |

### Test minimi

- fixture con `node_modules`, `dist`, `.codex/memory`, test e generated;
- file oltre `maxFileBytes`;
- path Windows normalizzato;
- ordinamento deterministico.

### Acceptance

`pmem scan --json` ritorna solo path relativi POSIX e non produce side effect.

---

## 4.4 `pmem index`

### Signature

```text
pmem index [--changed] [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "changedOnly": false,
    "files": {
      "scanned": 42,
      "indexed": 40,
      "skippedUnchanged": 0,
      "deleted": 1,
      "failed": 1
    },
    "records": {
      "modules": 4,
      "symbols": 118,
      "symbolEdges": 87,
      "routes": 12,
      "tests": 21,
      "warningsActive": 3,
      "warningsAdded": 2,
      "warningsResolved": 1
    },
    "state": {
      "status": "fresh",
      "memoryDirty": false
    }
  },
  "warnings": ["parser_warning: src/legacy/broken.ts skipped"]
}
```

### Side effects

- Scrive/aggiorna tabelle SQLite: `modules`, `files`, `symbols`, `symbol_edges`, `routes`, `tests`, `warnings`, `project_state`.
- Usa hard delete cascade per file rimossi.
- Usa replace-per-file per simboli, edge, routes, test link e warning per-file.
- Aggiorna stato memoria e timestamp index.

### Invarianti

- `--changed` usa hash/mtime/dimensione solo per decidere cosa reindicizzare, ma deve comunque rimuovere record di file cancellati.
- Un parse error su singolo file non blocca l'intero index: produce warning e `failed += 1`.
- Un errore DB/config/fs fatale blocca il comando.
- Gli unresolved import producono warning `unresolved_import`, non righe `symbol_edges` finte.
- Non crea tabella `features`.
- Non salva codice sorgente esteso.

### Error handling

| Caso | Codice |
|---|---|
| memoria non inizializzata | `NOT_INITIALIZED` |
| config invalida | `CONFIG_ERROR` |
| DB non apribile/schema incompatibile | `DB_ERROR` |
| errore scanner fatale | `INDEX_ERROR` |
| path fuori project root | `SAFETY_ERROR` |

### Test minimi

- index full su fixture NestJS/Express;
- index con file TS invalido;
- index `--changed` senza cambiamenti;
- index `--changed` con file modificato;
- index con file cancellato e cascade verificato;
- unresolved import -> warning e zero edge.

### Acceptance

Dopo `pmem index --json`, il DB deve rispettare lo schema di `05_DATA_MODEL_SQLITE.md`, FK attive e nessun record stale per file cancellati.

---

## 4.5 `pmem render`

### Signature

```text
pmem render [--frame current|overview|modules|duplicates|risks] [--no-png] [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "frames": [
      {
        "frame": "current",
        "svg": ".codex/memory/current.svg",
        "png": null,
        "map": ".codex/memory/current.map.json",
        "sourceHash": "sha256:abc123",
        "generatedAt": "2026-06-09T00:00:00.000Z"
      }
    ],
    "generated": [".codex/memory/generated/current.json"],
    "pngRequested": false,
    "pngExported": false
  },
  "warnings": []
}
```

Se PNG export è richiesto ma fallisce:

```json
{
  "ok": true,
  "data": {
    "frames": [
      {
        "frame": "current",
        "svg": ".codex/memory/current.svg",
        "png": null,
        "map": ".codex/memory/current.map.json",
        "sourceHash": "sha256:abc123",
        "generatedAt": "2026-06-09T00:00:00.000Z"
      }
    ],
    "generated": [".codex/memory/generated/current.json"],
    "pngRequested": true,
    "pngExported": false
  },
  "warnings": ["png_export_failed: sharp native dependency unavailable"]
}
```

### Side effects

- Scrive SVG e map JSON con atomic write.
- Scrive generated JSON deterministico.
- Aggiorna tabella `frames`.
- Scrive PNG solo se richiesto e disponibile.
- Aggiorna `project_state.last_rendered_at` su render SVG/map riuscito.

### Invarianti

- SVG e map JSON sono obbligatori.
- PNG è best-effort e nullable.
- `--no-png` disabilita export PNG senza warning.
- Failure PNG non cancella SVG/map validi.
- Output deterministico tra run identici, esclusi campi timestamp consentiti fuori source hash.
- `sourceHash` non include timestamp volatile.

### Error handling

| Caso | Codice |
|---|---|
| memoria non inizializzata | `NOT_INITIALIZED` |
| DB/config invalido | `DB_ERROR` / `CONFIG_ERROR` |
| frame invalido | `FRAME_NOT_FOUND` |
| impossibile scrivere SVG/map/generated | `RENDER_ERROR` o `FS_ERROR` |
| PNG export fallito | warning `png_export_failed`, non errore |

### Test minimi

- render current con PNG disabilitato;
- render current con PNG fallito;
- render named frame;
- SVG snapshot stabile;
- map JSON snapshot stabile;
- source hash stabile;
- path relativi e POSIX.

### Acceptance

`pmem render --json` è accettabile se `svg` e `map` esistono e `png` può essere `null` senza rendere il comando fallito.

---

## 4.6 `pmem head`

### Signature

```text
pmem head [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "status": "fresh",
    "memoryRoot": ".codex/memory",
    "schemaVersion": "1",
    "lastIndexedAt": "2026-06-09T00:00:00.000Z",
    "lastRenderedAt": "2026-06-09T00:00:00.000Z",
    "memoryDirty": false,
    "dirtyReason": "",
    "lastError": null,
    "currentFrame": {
      "frame": "current",
      "svg": ".codex/memory/current.svg",
      "png": null,
      "map": ".codex/memory/current.map.json"
    },
    "activeWarnings": 0
  },
  "warnings": []
}
```

Prima di init:

```json
{
  "ok": true,
  "data": {
    "status": "not_initialized",
    "memoryRoot": ".codex/memory",
    "schemaVersion": null,
    "lastIndexedAt": null,
    "lastRenderedAt": null,
    "memoryDirty": false,
    "dirtyReason": "",
    "lastError": null,
    "currentFrame": null,
    "activeWarnings": 0
  },
  "warnings": []
}
```

### Side effects

Nessuno.

### Invarianti

- Funziona prima di `init`.
- Non apre o ripara schema in modo distruttivo.
- Non considera PNG mancante come errore.
- Human output deve preferire `current.svg`/`current.map.json`, non `current.png`.

### Error handling

Corrupt DB/config viene rappresentato come `status="error"` quando possibile. `ok=false` è riservato a errori CLI non gestibili.

### Test minimi

- `not_initialized`;
- `fresh`;
- `dirty`;
- `stale`;
- `error` con lastError;
- frame con PNG `null`.

### Acceptance

`pmem head --json` deve essere adatto a controlli leggeri e non deve avere side effect.

---

## 4.7 `pmem query "<intent>"`

### Signature

```text
pmem query "<intent>" [--max-files 8] [--max-symbols 12] [--max-warnings 8] [--visual] [--json]
```

### Input

| Campo | Tipo | Default | Regola |
|---|---|---:|---|
| `intent` | string | obbligatorio | trim, lunghezza 3..500 |
| `--max-files` | integer | config `agents.maxFiles` o `8` | range 1..20 |
| `--max-symbols` | integer | config `agents.maxSymbols` o `12` | range 1..40 |
| `--max-warnings` | integer | config `agents.maxWarnings` o `8` | range 0..20 |
| `--visual` | boolean | `false` | include frame ref se disponibile |

### Output JSON

```json
{
  "ok": true,
  "data": {
    "intent": "aggiungi controllo accesso abbonamento sospeso",
    "contextPack": {
      "summary": "Relevant access-control files and symbols.",
      "modules": [
        { "id": "access", "name": "Access", "reason": "intent token match", "score": 0.91 }
      ],
      "files": [
        { "path": "src/access/access.service.ts", "moduleId": "access", "reason": "service match", "score": 0.88, "isTest": false }
      ],
      "symbols": [
        { "fqName": "AccessService.canEnter", "kind": "method", "filePath": "src/access/access.service.ts", "reason": "symbol match", "score": 0.93 }
      ],
      "constraints": ["Do not create a second access service before checking duplicates."],
      "warnings": [],
      "nextCommands": ["pmem duplicates --kind service \"controllo accesso abbonamento sospeso\" --json"],
      "visualFrame": {
        "frame": "current",
        "svg": ".codex/memory/current.svg",
        "png": null,
        "map": ".codex/memory/current.map.json"
      }
    }
  },
  "warnings": []
}
```

### Side effects

- Scrive retrieval log compatto in `retrieval_logs`.
- Non modifica codice sorgente, DB strutturale o frame.

### Invarianti

- Usa micro-agent rule-based, non LLM obbligatorio.
- Rispetta limiti massimi.
- Non include dump ampio di codice sorgente.
- Ordina risultati per score desc, poi path/nome ascendente come da `04`.
- Se memoria è dirty/stale, aggiunge warning ma non auto-refresh.

### Error handling

| Caso | Codice |
|---|---|
| intent vuoto/troppo lungo | `VALIDATION_ERROR` |
| memoria non inizializzata | `NOT_INITIALIZED` |
| DB/config invalido | `DB_ERROR` / `CONFIG_ERROR` |
| agente fallisce validazione output | `AGENT_ERROR` |

### Test minimi

- intent demo tornello/abbonamento;
- max-files/max-symbols rispettati;
- `--visual` con PNG null;
- memoria dirty produce warning;
- nessun source dump in output.

### Acceptance

`pmem query --json` deve produrre un context pack breve, ordinato e direttamente utilizzabile da Codex senza interpretazione libera.

---

## 4.8 `pmem duplicates --kind <kind> "<intent>"`

### Signature

```text
pmem duplicates --kind <kind> "<intent>" [--module <moduleId>] [--name <proposedName>] [--json]
```

### Input

| Campo | Tipo | Default | Regola |
|---|---|---:|---|
| `--kind` | `ArtifactKind` | obbligatorio | valori esatti da `04` |
| `intent` | string | obbligatorio | trim, lunghezza 3..500 |
| `--module` | string | opzionale | id modulo se noto |
| `--name` | string | opzionale | nome artifact proposto |

### Output JSON

```json
{
  "ok": true,
  "data": {
    "kind": "service",
    "intent": "validazione diritto accesso",
    "risk": "high",
    "verdict": "extend_existing_artifact",
    "matches": [
      {
        "kind": "service",
        "symbolId": 12,
        "fileId": 3,
        "name": "AccessService",
        "fqName": "AccessService",
        "filePath": "src/access/access.service.ts",
        "moduleId": "access",
        "similarity": 0.87,
        "reason": "same kind and strong normalized name/intent overlap"
      }
    ],
    "recommendation": "Extend AccessService instead of creating a new service."
  },
  "warnings": []
}
```

### Side effects

- Legge DB.
- Può scrivere candidate/log compatti in `duplicate_candidates` o `retrieval_logs` se previsto dal modulo agent/store.
- Non modifica sorgenti.

### Invarianti

- High-risk non ritorna mai `create_new_artifact`.
- Soglie duplicate sono quelle di `04`: high `>=0.80`, medium `>=0.45`, low `<0.45`.
- Exact same artifact kind + same normalized name/module => high sempre.
- Risultati ordinati per similarity desc, poi path/nome ascendente.

### Error handling

| Caso | Codice |
|---|---|
| kind non valido | `VALIDATION_ERROR` |
| intent invalido | `VALIDATION_ERROR` |
| memoria non inizializzata | `NOT_INITIALIZED` |
| DB/config invalido | `DB_ERROR` / `CONFIG_ERROR` |
| agente fallisce | `AGENT_ERROR` |

### Test minimi

- `AccessService` esistente blocca service simile;
- medium risk produce `needs_human_review`;
- low risk produce `create_new_artifact`;
- exact name/module override high;
- kind invalido fallisce.

### Acceptance

Prima di creare service/controller/DTO/route/table/module/utility, Codex deve poter usare questo comando per ottenere un verdetto deterministico.

---

## 4.9 `pmem refresh`

### Signature

```text
pmem refresh [--changed-only] [--no-render] [--reason <reason>] [--json]
```

### Input

| Campo | Tipo | Default | Regola |
|---|---|---:|---|
| `--changed-only` | boolean | `true` | flag accettato per chiarezza; default già changed-only |
| `--no-render` | boolean | `false` | salta render e segnala warning `render_skipped` |
| `--reason` | string | `manual` | lunghezza massima 200 |

### Output JSON

```json
{
  "ok": true,
  "data": {
    "changedOnly": true,
    "reason": "manual",
    "index": {
      "filesScanned": 5,
      "filesIndexed": 2,
      "filesDeleted": 1,
      "warningsActive": 1
    },
    "render": {
      "skipped": false,
      "frames": [
        {
          "frame": "current",
          "svg": ".codex/memory/current.svg",
          "png": null,
          "map": ".codex/memory/current.map.json"
        }
      ],
      "pngExported": false
    },
    "state": {
      "status": "fresh",
      "memoryDirty": false
    }
  },
  "warnings": ["png_export_failed: sharp native dependency unavailable"]
}
```

Con `--no-render`:

```json
{
  "ok": true,
  "data": {
    "changedOnly": true,
    "reason": "manual",
    "index": {
      "filesScanned": 5,
      "filesIndexed": 2,
      "filesDeleted": 0,
      "warningsActive": 0
    },
    "render": {
      "skipped": true,
      "frames": [],
      "pngExported": false
    },
    "state": {
      "status": "stale",
      "memoryDirty": false
    }
  },
  "warnings": ["render_skipped: visual frame may be stale"]
}
```

### Side effects

- Esegue index changed-only.
- Esegue render current salvo `--no-render`.
- Aggiorna stato memoria.
- Può risolvere warning non più presenti tramite lifecycle store.

### Invarianti

- Default changed-only.
- Non fa full scan pesante da lifecycle implicito.
- PNG failure non è fatale.
- File cancellati vengono rimossi via hard delete cascade.
- Se render viene saltato, lo stato può diventare `stale` per segnalare visual frame non aggiornato.

### Error handling

| Caso | Codice |
|---|---|
| memoria non inizializzata | `NOT_INITIALIZED` |
| config/DB invalido | `CONFIG_ERROR` / `DB_ERROR` |
| index fatale | `INDEX_ERROR` |
| render SVG/map fatale | `RENDER_ERROR` |
| PNG failure | warning `png_export_failed`, non errore |

### Test minimi

- dirty -> refresh -> fresh;
- unchanged skip;
- file cancellato rimosso;
- PNG failure warning non fatale;
- `--no-render` produce `render_skipped` e status `stale`;
- lifecycle changed-only, non full scan.

### Acceptance

`pmem refresh --json` deve essere il comando sicuro da usare dopo modifiche Codex: aggiorna memoria locale senza estendere scope o richiedere LLM.

---

## 4.10 `pmem frame <frame>`

### Signature

```text
pmem frame current|overview|modules|duplicates|risks [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "frame": "current",
    "svg": ".codex/memory/current.svg",
    "png": null,
    "map": ".codex/memory/current.map.json",
    "sourceHash": "sha256:abc123",
    "generatedAt": "2026-06-09T00:00:00.000Z",
    "summary": {
      "nodes": 17,
      "edges": 24,
      "warnings": 1
    }
  },
  "warnings": []
}
```

### Side effects

Nessuno. `frame` non invoca render implicito in v0.1.

### Invarianti

- Legge registry/tabella `frames` e file esistenti.
- `png` può essere `null`.
- Path relativi alla project root.
- Frame validi esatti: `current`, `overview`, `modules`, `duplicates`, `risks`.

### Error handling

| Caso | Codice |
|---|---|
| frame name invalido | `FRAME_NOT_FOUND` o `VALIDATION_ERROR` |
| memoria non inizializzata | `NOT_INITIALIZED` |
| frame non registrato | `FRAME_NOT_FOUND` |
| SVG/map mancante per frame registrato | `STATE_ERROR` |
| PNG mancante | nessun errore, `png=null` |

### Test minimi

- frame current esistente con PNG null;
- frame overview esistente;
- frame mancante;
- SVG mancante ma record DB presente -> `STATE_ERROR`;
- path relativi.

### Acceptance

`pmem frame current --json` deve essere stabile e non deve generare nuovi artifact.

---

## 4.11 `pmem diff`

### Signature

```text
pmem diff [--from previous] [--to current] [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "from": "previous",
    "to": "current",
    "changedFiles": ["src/access/access.service.ts"],
    "addedFiles": [],
    "removedFiles": [],
    "changedModules": ["access"],
    "addedSymbols": ["AccessService.canEnterWithSubscription"],
    "removedSymbols": [],
    "changedWarnings": {
      "added": ["unresolved_import: src/access/access.service.ts"],
      "resolved": []
    }
  },
  "warnings": []
}
```

Se snapshot mancanti:

```json
{
  "ok": true,
  "data": {
    "from": "previous",
    "to": "current",
    "changedFiles": [],
    "addedFiles": [],
    "removedFiles": [],
    "changedModules": [],
    "addedSymbols": [],
    "removedSymbols": [],
    "changedWarnings": { "added": [], "resolved": [] }
  },
  "warnings": ["snapshot_missing: previous"]
}
```

### Side effects

Nessuno. Snapshot e diff sono JSON su filesystem; il comando non crea snapshot in v0.1.

### Invarianti

- Non contiene sorgente.
- Array ordinati stabilmente.
- Snapshot mancanti producono warning compatto, non errore fatale.
- `current` può essere costruito leggendo DB corrente se previsto da `createMemorySnapshot(ctx, { write:false })`.

### Error handling

| Caso | Codice |
|---|---|
| memoria non inizializzata | `NOT_INITIALIZED` |
| ref snapshot invalido | `VALIDATION_ERROR` |
| DB/config invalido | `DB_ERROR` / `CONFIG_ERROR` |
| snapshot JSON corrotto | `VALIDATION_ERROR` o warning se recuperabile |

### Test minimi

- diff vuoto;
- file aggiunto;
- file rimosso;
- warning aggiunto/risolto;
- snapshot missing warning;
- nessun codice sorgente nell'output.

### Acceptance

`pmem diff --json` deve essere usabile da Codex per capire cosa è cambiato senza leggere direttamente SQLite.

---

## 4.12 `pmem agents install --scope project`

### Signature

```text
pmem agents install --scope project [--force] [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "scope": "project",
    "installed": [
      ".codex/agents/pmem-retriever.toml",
      ".codex/agents/pmem-duplicate-checker.toml",
      ".codex/agents/pmem-architecture-reviewer.toml"
    ],
    "skipped": [],
    "overwritten": []
  },
  "warnings": []
}
```

### Side effects

- Crea `.codex/agents/` se assente.
- Scrive template TOML subagenti opzionali.
- Non modifica `.codex/memory` salvo log opzionali non richiesti.
- Non installa backend, modelli o servizi.

### Invarianti

- Solo `--scope project` è valido in v0.1.
- Non sovrascrive file esistenti senza `--force`.
- I template sono read-only come comportamento atteso del subagente.
- La core path funziona anche senza questi file.

### Error handling

| Caso | Codice |
|---|---|
| scope diverso da `project` | `VALIDATION_ERROR` |
| file esistente senza `--force` | non errore: va in `skipped` |
| template interno mancante/invalido | `TEMPLATE_ERROR` |
| scrittura fallita | `FS_ERROR` |
| path fuori project root | `SAFETY_ERROR` |

### Test minimi

- install su progetto senza `.codex/agents`;
- reinstall senza force;
- reinstall con force;
- scope invalido;
- template validi e deterministici.

### Acceptance

`pmem agents install --scope project --json` installa solo template subagenti opzionali e non cambia il comportamento runtime core.

---

## 4.13 `pmem agents list`

### Signature

```text
pmem agents list [--json]
```

### Output JSON

```json
{
  "ok": true,
  "data": {
    "available": [
      { "name": "pmem_retriever", "template": "pmem-retriever.toml" },
      { "name": "pmem_duplicate_checker", "template": "pmem-duplicate-checker.toml" },
      { "name": "pmem_architecture_reviewer", "template": "pmem-architecture-reviewer.toml" }
    ],
    "installed": [
      { "name": "pmem_retriever", "path": ".codex/agents/pmem-retriever.toml" }
    ]
  },
  "warnings": []
}
```

### Side effects

Nessuno.

### Invarianti

- Funziona prima di `init`.
- Non richiede DB/config memoria.
- Non valida semanticamente output di Codex subagenti; elenca solo template/file.

### Error handling

| Caso | Codice |
|---|---|
| templates non leggibili | `TEMPLATE_ERROR` |
| filesystem non leggibile | `FS_ERROR` |

### Test minimi

- lista senza agenti installati;
- lista con uno o più agenti installati;
- template mancante;
- path relativi.

### Acceptance

`pmem agents list --json` è read-only e indipendente dalla memoria inizializzata.

---

## 5. Formato errori CLI

### 5.1 Shape canonica

```json
{
  "ok": false,
  "error": {
    "code": "CONFIG_ERROR",
    "message": "Invalid project-memory.config.json",
    "recoverable": true,
    "details": { "path": ".codex/memory/project-memory.config.json" }
  },
  "warnings": []
}
```

### 5.2 Codici ammessi

```text
INVALID_INPUT
VALIDATION_ERROR
NOT_INITIALIZED
ALREADY_EXISTS
CONFIG_ERROR
FS_ERROR
DB_ERROR
INDEX_ERROR
RENDER_ERROR
AGENT_ERROR
MCP_ERROR
SAFETY_ERROR
STATE_ERROR
FRAME_NOT_FOUND
TEMPLATE_ERROR
INTERNAL_ERROR
```

Nessun altro codice può essere emesso dal CLI v0.1.

### 5.3 Recoverability default

| Code | Default CLI recoverable |
|---|---:|
| `INVALID_INPUT` | true |
| `VALIDATION_ERROR` | true |
| `NOT_INITIALIZED` | true |
| `ALREADY_EXISTS` | true |
| `CONFIG_ERROR` | true |
| `FS_ERROR` | true |
| `DB_ERROR` | false |
| `INDEX_ERROR` | true |
| `RENDER_ERROR` | true |
| `AGENT_ERROR` | true |
| `MCP_ERROR` | true |
| `SAFETY_ERROR` | false |
| `STATE_ERROR` | true |
| `FRAME_NOT_FOUND` | true |
| `TEMPLATE_ERROR` | true |
| `INTERNAL_ERROR` | false |

La recoverability può essere resa più specifica in `details`, ma il default deve corrispondere a questa tabella e a `04_FUNCTION_CONTRACTS.md`.

---

## 6. Output human-readable

Output umano ammesso solo CLI interattiva.

Esempio `pmem head`:

```text
Project memory: fresh
Memory root: .codex/memory
Current SVG: .codex/memory/current.svg
Current map: .codex/memory/current.map.json
Current PNG: unavailable (optional)
Warnings: 0
```

Regole:

- massimo poche righe per default;
- suggerimenti comando ammessi solo se brevi;
- errori human-readable su stderr;
- mai usare output human-readable da MCP o automazioni;
- mai stampare stack trace salvo eventuale modalità dev non documentata in v0.1.

---

## 7. Test CLI obbligatori

| Area | Test | Acceptance |
|---|---|---|
| JSON mode | ogni comando con `--json` | stdout è un singolo JSON parseabile |
| Exit code | errore input, non init, frame missing | `1`/`2` coerenti |
| Path safety | output di ogni comando | path relativi POSIX, nessun assoluto |
| Init | DB/schema/config | schema v1, FK on, no `features` |
| Doctor | stati corrotti/non init | diagnostica senza side effect |
| Scan | include/exclude | `.codex/memory/**` sempre escluso |
| Index | parse error singolo file | warning non fatale |
| Index delete | file rimosso | hard delete cascade verificato |
| Render | PNG failure | `ok=true`, `png=null`, warning |
| Head | prima di init | `ok=true`, status `not_initialized` |
| Query | limiti output | maxFiles/maxSymbols rispettati, no code dump |
| Duplicates | high risk | mai `create_new_artifact` |
| Refresh | default | changed-only + render, PNG warning non fatale |
| Refresh no-render | `--no-render` | warning `render_skipped`, niente artifact render nuovi |
| Frame | PNG missing | `png=null`, non errore |
| Diff | snapshot missing | warning, diff vuoto |
| Agents install | reinstall | skipped senza force, overwrite con force |
| Agents list | before init | read-only, ok |

---

## 8. Acceptance criteria CLI v0.1

La CLI è accettabile solo se:

1. tutti i comandi documentati in sezione 1 sono implementati secondo questo contratto;
2. `validate` e `summarize` non esistono come comandi v0.1 e, se invocati, falliscono con `VALIDATION_ERROR`/unknown command;
3. ogni comando supporta `--json` e produce `CliResult<T>`;
4. nessun comando JSON emette prosa fuori JSON;
5. exit code `0/1/2` sono coerenti con la tabella;
6. `doctor` e `head` funzionano prima di `init`;
7. `doctor` verifica FK, schema v1, assenza `features`, SVG/map e PNG opzionale;
8. `render`, `frame`, `query` e `refresh` rappresentano PNG come `string | null`;
9. `index` applica hard delete cascade e warning lifecycle;
10. `refresh` è changed-only per default;
11. nessun comando modifica codice sorgente del repository target;
12. nessun comando richiede cloud, embeddings, vector DB, LLM o subagenti nella core path;
13. tutti gli errori usano solo `PmemErrorCode` canonici;
14. tutti i path in output sono relativi POSIX.

---

## 9. Allineamenti consolidati

| Documento | Vincolo CLI recepito |
|---|---|
| `07_MCP_TOOL_CONTRACTS.md` | MCP usa tipi coerenti e `visualFrame`/`frame` come `{ svg, png, map }` con `png: string \| null`; error mapping solo nel server MCP. |
| `08_RENDERER_VISUAL_CONTRACT.md` | `current.png` e `frames/*.png` sono opzionali; esempi usano `png: null`. |
| `09_AGENTS_AND_HOOKS_CONTRACT.md` | Opzioni `query`, `duplicates`, `refresh` e lifecycle skill/MCP sono allineati. |
| `10_TEST_PLAN_AND_ACCEPTANCE.md` | Test CLI coprono exit code, no `validate/summarize`, PNG nullable e doctor schema checks. |
| `11_CODEX_IMPLEMENTATION_PROMPTS.md` | Prompt P0/P2/P4/P5/P7 usano il CLI contract global-pass5 autonomous-ready. |
| `12_DEMO_SCENARIO.md` | Demo non richiede `current.png` obbligatorio e accetta `png_export_failed`. |
| `13_OPEN_ITEMS_AND_GUARDS.md` | Guardrail vietano comandi fuori scope e vietano PNG hard requirement. |
