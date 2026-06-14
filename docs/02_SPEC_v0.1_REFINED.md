# Codex Project Memory Plugin — SPEC raffinata v0.1

**Stato:** specifica architetturale raffinata global-pass5 autonomous-ready.  
**Tipo:** specifica stretta, non piano operativo.  
**Relazione con piano operativo:** questa SPEC spiega il perché; `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` decide il cosa e il quando.  
**Unità di distribuzione:** plugin Codex all-in-one.

---

## 1. Scopo

Il plugin costruisce e mantiene una memoria attiva, visuale e strutturata per ogni repository software.

Non è:

- una skill standalone;
- una documentazione statica;
- un RAG generico sul codice;
- un sistema di immagini AI libere;
- un sostituto del codice come fonte finale;
- un backend cloud;
- un sistema embedding/vector obbligatorio.

È un layer operativo per permettere a Codex di:

- orientarsi rapidamente nel repository;
- recuperare file e simboli esatti;
- prevenire duplicazioni;
- mantenere piccolo il contesto principale;
- aggiornare memoria visuale e strutturale dopo modifiche rilevanti.

---

## 2. Architettura sintetica

```text
Codex Project Memory Plugin
  ├─ plugin manifest
  ├─ MCP server
  ├─ repo-memory skill bundled
  ├─ lifecycle hooks
  ├─ pmem CLI
  ├─ SQLite project memory store
  ├─ TS/JS scanner + AST indexer
  ├─ deterministic SVG renderer
  ├─ JSON sidecar/map generator
  ├─ PNG fallback exporter
  ├─ rule-based micro-agent dispatcher
  └─ optional Codex subagent templates
```

Memoria per repository:

```text
repo/.codex/memory/
  project-memory.config.json
  memory.db
  current.svg                 required after render
  current.map.json            required after render
  current.png                 optional
  frames/
  generated/
  snapshots/
  cache/
  logs/
```

Codex legge memoria via MCP, non leggendo DB/file interni direttamente.

---

## 3. Principi non negoziabili

### 3.1 Plugin-first

Il plugin è il prodotto. La skill è solo documentazione operativa interna e non contiene memoria progetto.

### 3.2 MCP-first per Codex

Codex deve interrogare il plugin via MCP. Il database e i JSON generati sono dettagli interni. I tool MCP v0.1 sono esattamente:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

### 3.3 Visual-first, non AI-image-first

La memoria visuale è generata da dati strutturali tramite renderer deterministico. SVG e map JSON sono primari; PNG è fallback nullable.

### 3.4 Structure before semantics

Il matching semantico profondo, embeddings e vector search sono post-MVP. La v0.1 usa struttura, AST, path, nomi, regole e lessico semplice.

### 3.5 Duplicate guard obbligatorio

Prima di creare artefatti architetturali, Codex deve chiamare `memory.duplicates`.

Artefatti soggetti:

```text
service, controller, dto, type, interface, enum, repository, utility,
route, migration, table, job, adapter, module, feature
```

`feature` è un `ArtifactKind`, non una tabella DB v0.1.

### 3.6 Context pack compatto

Un context pack deve includere solo:

- summary breve;
- moduli rilevanti;
- file esatti;
- simboli rilevanti;
- vincoli;
- warning;
- next commands;
- eventuale `visualFrame` con `{ svg, png, map }` e `png` nullable.

Non deve includere dump codice, path assoluti o spiegazioni lunghe.

---

## 4. Componenti

| Componente | Responsabilità | Persistenza | Side effects |
|---|---|---|---|
| Plugin manifest | Espone plugin, skill, MCP, hooks | `.codex-plugin/plugin.json` | Nessuno runtime |
| MCP server | Interfaccia operativa per Codex | Nessuna diretta oltre store | Letture/refresh richiesti |
| Skill `repo-memory` | Istruzioni workflow | `skills/repo-memory/SKILL.md` | Nessuno |
| CLI `pmem` | Init/index/render/query locali | `.codex/memory/*` | Crea/aggiorna memoria |
| Store SQLite | Stato strutturale | `memory.db` | Scritture transazionali |
| Scanner/indexer | File, hash, simboli, route | DB + warnings | Legge repository |
| Renderer | SVG, map JSON, PNG nullable | `current.*`, `frames/*`, `generated/*` | Scrive output deterministici |
| Micro-agent dispatcher | Retrieval/duplicate/drift/risk rule-based | `retrieval_logs`, warnings | Nessuna modifica codice |
| Hooks | Dirty/refresh lifecycle | project_state/log | Aggiornamenti conservativi |
| Subagent templates | Agent opzionali read-only | `.codex/agents/*.toml` | Solo installazione template |

---

## 5. Micro-agent interni vs subagenti Codex

### Micro-agent interni

- vivono in `src/agents/`;
- sono invocati da CLI/MCP;
- sono obbligatori;
- in v0.1 sono rule-based;
- producono JSON compatto;
- non chiamano modelli esterni di default;
- non invocano subagenti Codex.

### Subagenti Codex opzionali

- vivono come template in `templates/agents/`;
- vengono installati in `repo/.codex/agents/`;
- sono read-only per retrieval/duplicate/review;
- servono a parallelizzare ricerca/review quando Codex li supporta;
- non devono diventare il cuore del runtime.

---

## 6. Stato memoria

Stati:

```text
not_initialized
initializing
fresh
stale
dirty
error
```

Transizioni:

```text
not_initialized -> initializing -> fresh
fresh -> dirty                  dopo modifica file
fresh -> stale                  se config/hash/timestamp non coerenti
dirty -> fresh                  dopo refresh riuscito
stale -> fresh                  dopo index/render riusciti
* -> error                      se schema/IO/parsing non recuperabile
error -> fresh                  dopo doctor/fix/refresh riuscito
```

`dirty` non significa memoria rotta; significa usabile ma da aggiornare prima di task seri.

---

## 7. Configurazione repository

Shape concettuale allineata a `ProjectMemoryConfig` di `04_FUNCTION_CONTRACTS.md`:

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
  },
  "hooks": {
    "enabled": true,
    "autoRefreshOnStop": true,
    "maxChangedFilesForStopRefresh": 20
  }
}
```

Regole:

- config assente è ammessa solo per `doctor`, `head` e hook leggeri documentati;
- config invalida produce `CONFIG_ERROR`;
- include/exclude non devono permettere indicizzazione di `.codex/memory/**`;
- `render.png=false` non è errore e produce `png=null`.

---

## 8. Vincoli dati

- SQLite è locale per repository.
- Schema v1 non contiene tabella `features`.
- File cancellati sono rimossi con hard delete cascade, non soft delete `deleted_at`.
- Import unresolved diventano warning `unresolved_import`, non edge fittizi.
- Warning per-file sono sostituiti/deduplicati per fingerprint.
- DB non contiene codice sorgente esteso, embeddings, vector o source chunks.
- Snapshot/diff v0.1 sono JSON file, non tabelle DB.

---

## 9. Vincoli di sicurezza e affidabilità

- Gli hook devono essere approvati/trustati dall'utente dopo installazione del plugin.
- Gli hook devono essere no-op sicuri se l'evento è incompleto.
- `UserPromptSubmit` non deve fare scan/index/render.
- `Stop` deve usare loop guard env + lock file.
- La CLI non deve cancellare dati utente fuori da `.codex/memory`.
- `pmem agents install` non deve sovrascrivere agenti modificati senza `--force`.
- Il renderer deve sanitizzare testo SVG.
- Errori di parsing file devono diventare warning, non crash globale.
- Export PNG fallito non invalida memoria.
- Nessun comando v0.1 deve modificare il codice sorgente del repository target.
- Nessun output pubblico deve contenere path assoluti.

---

## 10. Definizione finale v0.1

La v0.1 è completa quando Codex può usare il plugin per rispondere a queste tre domande prima di scrivere codice:

1. Qual è lo stato compatto del progetto?
2. Quali file/simboli devo toccare per questo intent?
3. Sto per creare un duplicato?

E quando il plugin può rigenerare una vista visuale deterministica dopo modifiche, con SVG/map obbligatori e PNG opzionale.

---

## 11. Default per agente non creativo

La SPEC non deve lasciare scelte implicite all'implementatore. Dove non esiste input utente esplicito, usare questi comportamenti:

| Area | Default v0.1 | Vietato improvvisare |
|---|---|---|
| Nome pacchetto | `codex-project-memory` | rinominare package/CLI senza aggiornare docs |
| CLI | `pmem` | aggiungere alias pubblici |
| MCP server | `project-memory` via stdio | HTTP server o daemon persistente |
| DB | `better-sqlite3`, schema v1 | migrazioni distruttive o ORM non documentato |
| Scanner | `fast-glob` + include/exclude config | indicizzare `.codex/memory/**` |
| AST | `ts-morph` per TS/JS | tree-sitter o parser multi-language |
| Validazione | `zod` o validatore equivalente locale | accettare input esterno non validato |
| PNG | `sharp` opzionale/best-effort | rendere PNG gate hard |
| Regole dominio | solo `criticalRules` e module hints | inventare policy architetturali |

`criticalRules` è parte della config canonica. Se assente nel file config legacy o scritto manualmente, il loader deve normalizzarlo a `[]` nel default/merge, non fallire per mancanza retrocompatibile v0.1.
