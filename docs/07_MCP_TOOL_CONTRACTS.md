# Codex Project Memory Plugin — contratti MCP v0.1

**Stato:** contratto MCP raffinato global-pass5 autonomous-ready, allineato a `04_FUNCTION_CONTRACTS.md`, `05_DATA_MODEL_SQLITE.md` e `06_CLI_CONTRACTS.md`.  
**Server:** `project-memory`.  
**Transport v0.1:** stdio.  
**Regola:** MCP è l'unica interfaccia operativa che Codex usa per leggere memoria di progetto.

---

## 0. Regole vincolanti MCP

1. Il server MCP espone solo i sei tool documentati qui.
2. Gli handler tool restituiscono output typed e, in caso di errore, lanciano `PmemError`.
3. Solo `src/mcp/server.ts` mappa `PmemError` in payload MCP strutturato.
4. Nessun handler MCP stampa prosa su stdout fuori protocollo.
5. Tutti i path in output sono relativi POSIX.
6. `memory.head` deve funzionare anche prima di `pmem init`.
7. Tutti gli altri tool richiedono memoria inizializzata e DB leggibile.
8. Nessun tool restituisce codice sorgente, dump SQL o generated JSON completi.
9. PNG è sempre `string | null`: assenza PNG non è errore se SVG/map esistono.
10. I limiti di output seguono `ProjectMemoryConfig.agents` e gli override validati dell'input.

---

## 1. Tool esposti

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

Tool vietati in v0.1:

```text
memory.sql
memory.dump
memory.search_embeddings
memory.summarize
memory.validate
memory.write_code
```

---

## 2. Contratto comune

### 2.1 Input

- Input validato con Zod o schema equivalente.
- Campi non riconosciuti sono ignorati solo se innocui; altrimenti `VALIDATION_ERROR`.
- Stringhe principali sono trim-only, mai normalizzate semanticamente in modo non documentato.
- `intent` vuoto o troppo lungo produce `VALIDATION_ERROR`.
- `frame` non valido produce `FRAME_NOT_FOUND` oppure `VALIDATION_ERROR` prima della lookup, coerentemente con `04`/`06`.

### 2.2 Output

Gli output MCP sono oggetti JSON typed, non wrapper `CliResult<T>`. Il wrapper MCP/error protocol è applicato dal server.

Regole:

```text
success -> typed object documentato dal tool
error   -> structured tool error con ErrorPayload canonico
```

Errore MCP compatto:

```json
{
  "error": {
    "code": "NOT_INITIALIZED",
    "message": "Project memory is not initialized. Run pmem init.",
    "recoverable": true,
    "details": {
      "nextCommand": "pmem init --json"
    }
  }
}
```

### 2.3 Error code canonici

Il server può emettere solo `PmemErrorCode` definiti in `04_FUNCTION_CONTRACTS.md`:

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
HOOK_ERROR
SAFETY_ERROR
STATE_ERROR
FRAME_NOT_FOUND
TEMPLATE_ERROR
INTERNAL_ERROR
```

### 2.4 Side effects comuni

| Tool | Side effects ammessi |
|---|---|
| `memory.head` | nessuno |
| `memory.query` | retrieval log compatto |
| `memory.duplicates` | retrieval/duplicate log; candidate persistito se già previsto dal data model |
| `memory.frame` | nessuno |
| `memory.refresh` | changed-only index, render opzionale, project state, warnings |
| `memory.diff` | nessuno |

---

## 3. `memory.head`

### Signature handler

```ts
async function handleMemoryHead(input: MemoryHeadInput, env: McpToolEnv): Promise<MemoryHeadOutput>
```

### Input

```json
{}
```

### Output

```json
{
  "project": "ProjectName",
  "branch": "main",
  "status": "fresh",
  "memoryRoot": ".codex/memory",
  "visualFrame": {
    "frame": "current",
    "svg": ".codex/memory/current.svg",
    "png": null,
    "map": ".codex/memory/current.map.json"
  },
  "lastIndexedAt": "2026-06-08T00:00:00.000Z",
  "lastRenderedAt": "2026-06-08T00:00:00.000Z",
  "topModules": [],
  "criticalRules": [],
  "warnings": [],
  "nextCommands": []
}
```

Se memoria non inizializzata:

```json
{
  "project": null,
  "branch": null,
  "status": "not_initialized",
  "memoryRoot": ".codex/memory",
  "visualFrame": null,
  "lastIndexedAt": null,
  "lastRenderedAt": null,
  "topModules": [],
  "criticalRules": [],
  "warnings": ["Project memory is not initialized."],
  "nextCommands": ["pmem init --json"]
}
```

### Invarianti

- Deve funzionare senza DB e senza config.
- DB corrotto non deve rompere il protocollo: output `status="error"` con warning compatto se possibile.
- `visualFrame.png` può essere `null`.
- Non legge `generated/*.json` se DB/frame registry basta.

### Error handling

| Caso | Comportamento |
|---|---|
| Non inizializzato | success output `not_initialized` |
| Config assente | success output con warning |
| DB corrotto | success output `error` se diagnosticabile, altrimenti `DB_ERROR` |
| Path traversal rilevato | `SAFETY_ERROR` non recuperabile |

### Test minimi

- non-init;
- fresh;
- dirty;
- frame senza PNG;
- DB corrotto;
- nessun path assoluto.

---

## 4. `memory.query`

### Signature handler

```ts
async function handleMemoryQuery(input: MemoryQueryInput, env: McpToolEnv): Promise<MemoryQueryOutput>
```

### Input

```json
{
  "intent": "aggiungi controllo accesso abbonamento sospeso",
  "maxFiles": 8,
  "maxSymbols": 12,
  "maxWarnings": 8,
  "includeVisualFrame": true
}
```

### Output

```json
{
  "intent": "aggiungi controllo accesso abbonamento sospeso",
  "contextPack": {
    "summary": "Modifica probabilmente nel modulo Access con dipendenza da Subscriptions.",
    "modules": [],
    "files": [],
    "symbols": [],
    "constraints": [],
    "warnings": [],
    "nextCommands": ["memory.duplicates"],
    "visualFrame": {
      "frame": "current",
      "svg": ".codex/memory/current.svg",
      "png": null,
      "map": ".codex/memory/current.map.json"
    }
  }
}
```

### Invarianti

- Usa `retrieval-agent` rule-based.
- Rispetta `maxFiles`, `maxSymbols`, `maxWarnings` dopo clamp ai limiti config.
- Non include codice sorgente.
- Se memoria `dirty` o `stale`, include warning e `nextCommands` appropriati, non fa refresh implicito.
- Tie-break deterministico: score desc, path asc, symbol name asc.

### Error handling

| Caso | Codice |
|---|---|
| `intent` vuoto/troppo lungo | `VALIDATION_ERROR` |
| memoria assente | `NOT_INITIALIZED` |
| agent output invalido | `AGENT_ERROR` |
| DB non leggibile | `DB_ERROR` |

### Test minimi

- query fixture Access/Subscriptions;
- limiti output;
- memoria dirty;
- intent invalido;
- visualFrame con PNG null;
- nessun source dump.

---

## 5. `memory.duplicates`

### Signature handler

```ts
async function handleMemoryDuplicates(input: MemoryDuplicatesInput, env: McpToolEnv): Promise<MemoryDuplicatesOutput>
```

### Input

```json
{
  "kind": "service",
  "intent": "validazione diritto accesso tornello",
  "moduleId": "access",
  "proposedName": "AccessValidationService"
}
```

### Output

```json
{
  "risk": "high",
  "verdict": "extend_existing_artifact",
  "matches": [
    {
      "kind": "service",
      "name": "AccessService",
      "path": "src/access/access.service.ts",
      "moduleId": "access",
      "similarity": 0.91,
      "reason": "same module, same artifact kind, overlapping access validation tokens"
    }
  ],
  "recommendation": "Estendere AccessService invece di creare un nuovo servizio."
}
```

### Invarianti

- Usa `duplicate-agent` rule-based.
- Soglie canoniche:

```text
high   >= 0.80 -> extend_existing_artifact
medium >= 0.45 -> needs_human_review
low    <  0.45 -> create_new_artifact
```

- Exact same artifact kind + same normalized name/module = `high` sempre.
- `high` non può mai restituire `create_new_artifact`.

### Error handling

| Caso | Codice |
|---|---|
| kind non supportato | `VALIDATION_ERROR` |
| intent invalido | `VALIDATION_ERROR` |
| memoria assente | `NOT_INITIALIZED` |
| agent failure | `AGENT_ERROR` |

### Test minimi

- service duplicato high;
- utility non duplicata low;
- medium risk;
- exact-name override;
- nessun codice sorgente in output.

---

## 6. `memory.frame`

### Signature handler

```ts
async function handleMemoryFrame(input: MemoryFrameInput, env: McpToolEnv): Promise<MemoryFrameOutput>
```

### Input

```json
{
  "frame": "overview"
}
```

### Output

```json
{
  "frame": "overview",
  "svg": ".codex/memory/frames/overview.svg",
  "png": null,
  "map": ".codex/memory/frames/overview.map.json",
  "summary": "Overview frame for project modules and risks.",
  "warnings": ["png_missing"]
}
```

### Invarianti

- Non renderizza implicitamente in v0.1.
- Restituisce solo path registrati e validati.
- `svg` e `map` sono obbligatori per frame valido.
- `png` può essere `null`.
- Frame ammessi: `current`, `overview`, `modules`, `duplicates`, `risks`.

### Error handling

| Caso | Codice |
|---|---|
| frame non valido/non registrato | `FRAME_NOT_FOUND` |
| svg/map mancanti | `FRAME_NOT_FOUND` o `RENDER_ERROR` recuperabile |
| memoria assente | `NOT_INITIALIZED` |

### Test minimi

- current;
- overview;
- PNG mancante;
- frame inesistente;
- path relativo POSIX.

---

## 7. `memory.refresh`

### Signature handler

```ts
async function handleMemoryRefresh(input: MemoryRefreshInput, env: McpToolEnv): Promise<MemoryRefreshOutput>
```

### Input

```json
{
  "changedOnly": true,
  "render": true,
  "reason": "post-code-change"
}
```

### Output

```json
{
  "status": "updated",
  "changedOnly": true,
  "changedFiles": 3,
  "indexedFiles": 3,
  "deletedFiles": 0,
  "updatedTables": ["files", "symbols", "routes", "warnings", "frames"],
  "updatedFrames": ["current"],
  "visualFrame": {
    "frame": "current",
    "svg": ".codex/memory/current.svg",
    "png": null,
    "map": ".codex/memory/current.map.json"
  },
  "warnings": ["png_export_failed: sharp native dependency unavailable"]
}
```

### Invarianti

- `changedOnly` default true.
- Non usa full scan se invocato da hook Stop salvo comando esplicito fuori hook e documentato.
- Applica hard delete cascade per file cancellati.
- Applica warning lifecycle/dedupe per file indicizzati.
- Render è eseguito se `render=true`; PNG failure non è fatale.
- Aggiorna project state a `fresh` solo se index e SVG/map render sono riusciti.

### Error handling

| Caso | Codice |
|---|---|
| memoria assente | `NOT_INITIALIZED` |
| index fatal | `INDEX_ERROR` |
| render SVG/map fatal | `RENDER_ERROR` |
| PNG failure | warning `png_export_failed`, success |
| DB failure | `DB_ERROR` |

### Test minimi

- dirty -> fresh;
- no changes;
- file cancellato cascade;
- PNG fail;
- render=false;
- output senza path assoluti.

---

## 8. `memory.diff`

### Signature handler

```ts
async function handleMemoryDiff(input: MemoryDiffInput, env: McpToolEnv): Promise<MemoryDiffOutput>
```

### Input

```json
{
  "from": "previous",
  "to": "current"
}
```

### Output

```json
{
  "changedFiles": [],
  "changedModules": [],
  "addedSymbols": [],
  "removedSymbols": [],
  "newWarnings": [],
  "resolvedWarnings": [],
  "warnings": []
}
```

### Invarianti

- Output ordinato e compatto.
- Nessun contenuto codice.
- Snapshot mancanti non bloccano: diff vuoto + warning recuperabile.
- Ref ammessi v0.1: `previous`, `latest`, `current`, oppure path snapshot relativo validato sotto `.codex/memory/snapshots`.

### Error handling

| Caso | Codice/Comportamento |
|---|---|
| snapshot mancanti | success con diff vuoto + warning |
| ref invalido | `VALIDATION_ERROR` |
| snapshot corrotto | `VALIDATION_ERROR` recuperabile se si può tornare diff vuoto |
| memoria assente | `NOT_INITIALIZED` |

### Test minimi

- snapshots mancanti;
- file cambiato;
- simbolo aggiunto/rimosso;
- warning nuovo/risolto;
- no code dump.

---

## 9. Istruzioni server-wide per Codex

Il server MCP deve comunicare queste regole operative nel prompt/tool description del server, non come output prolisso dei tool:

```text
Use memory.head first.
Use memory.query for task context.
Use memory.duplicates before creating architectural artifacts.
Open only returned files unless there is a clear reason to explore more.
After architecture-relevant changes, call memory.refresh.
Do not read memory.db directly.
Do not treat missing PNG as memory failure.
```

---

## 9.1 Algoritmo MCP per agente Codex semplice

Quando Codex deve lavorare su un repository con questo plugin, deve seguire questa sequenza minima:

```text
1. call memory.head
2. if status == not_initialized:
     ask/use CLI pmem init --json before relying on memory
3. if status in dirty|stale and task is architecture-relevant:
     call memory.refresh(changedOnly=true, render=true, reason="pre-task")
4. call memory.query(intent, includeVisualFrame=true)
5. before creating any ArtifactKind listed in 02:
     call memory.duplicates(kind, intent, moduleId/proposedName if known)
6. if duplicates.risk == high:
     extend existing artifact; do not create new artifact
7. open only files returned by memory.query/duplicates unless tests require adjacent file
8. after changes:
     call memory.refresh(changedOnly=true, render=true, reason="post-task")
9. call memory.diff(from="previous", to="current") if summary is needed
```

Regole:

- `memory.frame` è solo lettura di frame registrati: non aspettarsi render implicito;
- `memory.refresh` è l'unico tool MCP che può aggiornare DB/render;
- se un tool restituisce `png:null`, non ritentare render solo per ottenere PNG;
- se `memory.query` ritorna pochi file, non allargare manualmente a tutto il repo senza motivo esplicito.

---

## 10. Acceptance MCP v0.1

MCP è accettabile solo se:

1. espone esattamente i sei tool documentati;
2. `memory.head` funziona prima di init;
3. gli altri tool falliscono con `NOT_INITIALIZED` recuperabile se memoria assente;
4. tutti gli output path sono relativi POSIX;
5. `visualFrame` e `frame` usano `{ svg, png, map }` con `png: string \| null`;
6. nessun tool restituisce codice, SQL dump o generated JSON completo;
7. error mapping avviene solo nel server MCP;
8. `memory.refresh` è changed-only per default;
9. PNG failure produce warning, non errore tool;
10. i test MCP coprono success, non-init, invalid input e PNG null.
