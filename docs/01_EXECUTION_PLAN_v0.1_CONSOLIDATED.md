# Codex Project Memory Plugin — piano esecutivo consolidato v0.1

**Stato:** fonte operativa autoritativa global-pass5 autonomous-ready per implementazione MVP.  
**Origine:** consolidamento documentale v0.1; la baseline corrente è composta dai documenti canonici `00`–`17`.  
**Target:** plugin Codex all-in-one, non skill standalone.  
**Runtime:** Node.js 20+, TypeScript.  
**Store:** SQLite locale per repository.  
**Indexer v0.1:** TypeScript/JavaScript via `ts-morph`.  
**Renderer v0.1:** SVG deterministico, map JSON obbligatoria, PNG fallback nullable.  
**Agenti v0.1:** micro-agent interni rule-based; subagenti Codex opzionali.  
**Principio guida:** il Codex principale deve vedere poco, ma giusto. Output pubblici compatti, path relativi POSIX, niente codice sorgente nei context pack.

---

## 0. Regola di autorità documentale

Questo documento è la fonte operativa primaria. Se un altro documento canonico `00`–`17` diverge da questo file, prevale questo file, salvo contratti funzione più specifici in `04_FUNCTION_CONTRACTS.md`.

I dettagli esecutivi a livello funzione sono in `04_FUNCTION_CONTRACTS.md`; se un nome funzione o una signature non è in quel file, Codex non deve inventarla senza aggiornare la documentazione.

---

## 1. Obiettivo operativo della v0.1

Costruire un MVP realmente installabile e dimostrabile del plugin **Codex Project Memory**.

Ciclo minimo:

```text
install plugin
  -> open repository
  -> pmem init
  -> pmem index
  -> pmem render
  -> Codex calls memory.head
  -> Codex calls memory.query
  -> Codex calls memory.duplicates before creating artifacts
  -> code changes happen
  -> memory.refresh updates changed index + visual frame
```

La v0.1 deve dimostrare che:

- il plugin è installabile e buildabile;
- la memoria resta locale al repository;
- il contesto restituito a Codex è compatto;
- i file corretti vengono trovati;
- la duplicate guard segnala creazioni inutili;
- la memoria visuale è generata in modo deterministico.

---

## 2. Decisioni chiuse

### 2.1 Plugin-first

Distribuzione:

```text
.codex-plugin/plugin.json
.mcp.json
skills/
hooks/
assets/
src/
```

La skill `repo-memory` è solo manuale operativo. Non contiene memoria di progetto.

### 2.2 MCP come interfaccia operativa Codex

Codex deve usare solo:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

Codex non deve leggere direttamente:

```text
.codex/memory/memory.db
.codex/memory/generated/*.json
```

### 2.3 Memoria per repository

Percorso standard:

```text
repo/.codex/memory/
```

Nessuna memoria globale condivisa nella v0.1.

### 2.4 Visual first deterministico

Pipeline:

```text
filesystem + AST + config + SQLite
  -> normalized graph JSON
  -> deterministic SVG renderer
  -> optional PNG export
  -> sidecar map JSON
```

Output obbligatorio/fallback:

```text
.codex/memory/current.svg       # obbligatorio
.codex/memory/current.map.json  # obbligatorio
.codex/memory/current.png       # opzionale: solo se export PNG riesce
```

SVG e map JSON sono primari. PNG è fallback compatibile.

### 2.5 Structure before semantics

Ordine di affidabilità:

```text
1. project-memory.config.json
2. AST / file / route / test index
3. SQLite memory.db
4. generated JSON
5. lexical matching
6. optional model/subagent reasoning
```

Embedding e vector search sono fuori v0.1.

### 2.6 Due livelli di agenti

```text
A. Micro-agent interni runtime
   - obbligatori
   - rule-based in v0.1
   - strict JSON
   - usati da CLI/MCP

B. Subagenti Codex opzionali
   - template generati in .codex/agents/
   - read-only per retrieval/duplicate
   - invocati esplicitamente dal Codex principale
   - non sono parte obbligatoria del runtime
```

### 2.7 Hook lifecycle conservativo

- `UserPromptSubmit`: solo check leggero; mai scan pesante.
- `PostToolUse`: marca dirty se rileva file modificati.
- `Stop`: refresh changed-only solo se dirty e config abilitata.
- `SubagentStop`: registra output/warning strutturati; no side effect pesanti.

Gli hook devono sopravvivere a input vuoto o incompleto.

### 2.8 Linguaggi v0.1

Copertura parser:

```text
.ts
.tsx
.js
.jsx
.mts
.cts
```

NestJS route inference è utile ma non bloccante.

### 2.9 Contratti global-pass5 autonomous-ready chiusi

Decisioni trasversali ormai vincolanti:

```text
SQLite schema v1 senza features table
file cancellati -> hard delete cascade
unresolved imports -> warning, non symbol_edges testuali
warning lifecycle -> fingerprint/dedupe
SVG + map JSON -> obbligatori
PNG -> nullable/best-effort
MCP visualFrame/frame -> { svg, png, map } con png nullabile
retrieval/duplicate -> scoring deterministico
Stop hook -> loop guard env + lock file
public outputs -> path relativi POSIX, no source code dump
```

### 2.10 Default implementativi per sviluppo autonomo

Un agente non deve chiedere decisioni su questi punti in v0.1. Deve usare i default sotto.

#### Package e toolchain

```json
{
  "name": "codex-project-memory",
  "version": "0.1.0",
  "type": "module",
  "bin": { "pmem": "dist/cli/pmem.js" },
  "engines": { "node": ">=20" }
}
```

Script minimi richiesti:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/cli/pmem.ts",
    "mcp": "node dist/mcp/server.js"
  }
}
```

Dipendenze consentite v0.1, senza version pin hard nel documento:

```text
runtime dependencies:
  @modelcontextprotocol/sdk
  better-sqlite3
  commander
  fast-glob
  picomatch
  ts-morph
  zod

optional dependency:
  sharp        # solo PNG best-effort; fallimento -> png=null + warning

dev dependencies:
  @types/better-sqlite3
  @types/node
  tsx
  typescript
  vitest
```

Regole:

- se `sharp` non si installa o fallisce runtime, il renderer resta valido con `png=null`;
- non introdurre dipendenze alternative per DB, parser AST, MCP o renderer senza aggiornare `13_OPEN_ITEMS_AND_GUARDS.md`;
- non aggiungere ESLint/Prettier come gate v0.1 se non già richiesti dal pass;
- usare ESM Node.js 20+, niente CommonJS salvo compatibilità strettamente necessaria per una dependency nativa.

#### Default repository/plugin

```text
CLI command: pmem
MCP server name: project-memory
default branch display: valore git branch se disponibile, altrimenti null
default projectName: package.json name se disponibile, altrimenti basename root
default frame: current
default refresh: changedOnly=true, render=true
default query limits: maxFiles=8, maxSymbols=12, maxWarnings=8
default hook Stop max changed files: 20
```

Un agente può cambiare questi default solo se aggiorna prima i contratti canonici e i test.

---

## 3. Dentro e fuori perimetro

### 3.1 Dentro v0.1

- plugin manifest;
- MCP config;
- skill interna;
- hook bundle;
- CLI `pmem`;
- `.codex/memory` per repository;
- SQLite schema v1 senza `features`;
- hard delete cascade per file cancellati;
- scanner file;
- TS/JS AST indexer;
- module inference da path + config;
- route inference NestJS base;
- deterministic SVG renderer;
- PNG export best-effort;
- sidecar JSON map obbligatoria;
- tool MCP minimi con path relativi POSIX;
- duplicate guard base con soglie deterministiche;
- micro-agent dispatcher rule-based;
- custom agent templates opzionali;
- fixture repository;
- test minimi;
- demo scenario.

### 3.2 Fuori v0.1

- embedding/vector DB reale;
- tabella `features` nel DB v1;
- soft delete `deleted_at` per file v0.1;
- edge testuali unresolved in `symbol_edges`;
- tree-sitter multi-linguaggio;
- monorepo avanzato;
- timeline visuale evoluta;
- marketplace remoto definitivo;
- dashboard web;
- auto-refactor architetturale;
- analisi semantica profonda con modello per default;
- PR/GitHub integration;
- memoria condivisa team;
- policy enterprise;
- editor visuale dei frame.

---

## 4. Deliverable repository plugin

```text
codex-project-memory/
  package.json
  tsconfig.json
  vitest.config.ts
  README.md

  docs/
    00_DOCS_INDEX.md
    01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md
    02_SPEC_v0.1_REFINED.md
    03_IMPLEMENTATION_PLAN_v0.1_REFINED.md
    04_FUNCTION_CONTRACTS.md
    05_DATA_MODEL_SQLITE.md
    06_CLI_CONTRACTS.md
    07_MCP_TOOL_CONTRACTS.md
    08_RENDERER_VISUAL_CONTRACT.md
    09_AGENTS_AND_HOOKS_CONTRACT.md
    10_TEST_PLAN_AND_ACCEPTANCE.md
    11_CODEX_IMPLEMENTATION_PROMPTS.md
    12_DEMO_SCENARIO.md
    13_OPEN_ITEMS_AND_GUARDS.md
    14_IMPLEMENTATION_MATRIX.md
    15_STATIC_FILE_TEMPLATES.md
    16_PUBLIC_SCHEMAS.md
    17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md

  .codex-plugin/
    plugin.json

  .mcp.json

  skills/
    repo-memory/
      SKILL.md
      agents/
        openai.yaml

  hooks/
    hooks.json

  bin/
    pmem

  src/
    cli/
      pmem.ts
      commands/
    mcp/
      server.ts
      tools/
    runtime/
    store/
    indexer/
    renderer/
    agents/
    hooks/
    shared/

  templates/
    agents/

  test/
    fixtures/
      nest-basic/
    *.test.ts

  assets/
    icon.png
    logo.png
```

Repository inizializzato:

```text
repo/.codex/memory/
  project-memory.config.json
  memory.db
  current.svg
  current.map.json
  current.png  # opzionale
  frames/
  generated/
  snapshots/
  cache/
  logs/
```

Subagenti opzionali:

```text
repo/.codex/agents/
  pmem-retriever.toml
  pmem-duplicate-checker.toml
  pmem-architecture-reviewer.toml
```

---

## 5. Fasi operative P0–P9

### P0 — Scaffold e build base

**Obiettivo:** creare una repo plugin buildabile e testabile.

**Task:**

- creare `package.json`, `tsconfig.json`, `vitest.config.ts`;
- creare `bin/pmem`;
- creare `src/cli/pmem.ts`;
- creare `src/shared/version.ts`;
- configurare ESM;
- aggiungere script npm;
- aggiungere placeholder test.

**Gate:**

```bash
npm install
npm run build
npm test
node dist/cli/pmem.js --help
```

### P1 — Manifest plugin, MCP config, skill skeleton

**Obiettivo:** rendere il pacchetto riconoscibile come plugin all-in-one.

**Task:**

- creare `.codex-plugin/plugin.json`;
- creare `.mcp.json`;
- creare `skills/repo-memory/SKILL.md`;
- creare `skills/repo-memory/agents/openai.yaml`;
- creare asset placeholder;
- documentare installazione locale;
- esplicitare che gli hook richiedono trust/review.

**Gate:** build/test + verifica path manifest.

### P2 — Runtime paths, config e SQLite store

**Obiettivo:** implementare memoria locale di repository.

**Task:**

- repo root locator;
- memory path resolver;
- config loader/default writer;
- SQLite schema;
- repository base;
- `pmem init`, `pmem doctor`, `pmem head`.

**Gate:** `pmem init` crea `.codex/memory`, `memory.db`, config; `pmem doctor --json` ok.

### P3 — Scanner e indexer AST

**Obiettivo:** costruire memoria strutturale minima.

**Task:**

- scanner include/exclude;
- hash file;
- classificazione language/test/generated;
- module inference;
- symbol extraction TS/JS;
- import/export edges;
- NestJS route inference base;
- changed-only.

**Gate:** `pmem scan --json`, `pmem index`, `pmem index --changed` funzionano; errori AST non bloccano tutto.

### P4 — Generated JSON e renderer visuale

**Obiettivo:** produrre frame visuali e sidecar interrogabili.

**Task:**

- normalized graph da SQLite;
- JSON in `generated/`;
- SVG deterministico;
- frame overview/modules/duplicates/risks;
- PNG export best-effort con `png=null` su fallimento/disabilitazione;
- `current.map.json` obbligatorio;
- registrazione frames nel DB.

**Gate:** output stabile tra due run identici; PNG failure non invalida SVG/map.

### P5 — Micro-agent dispatcher rule-based

**Obiettivo:** retrieval, duplicate, drift, architecture e render wrapper deterministici.

**Task:**

- tipi/Zod input-output;
- dispatcher;
- retrieval-agent con scoring deterministico;
- duplicate-agent con soglie high/medium/low;
- drift-agent;
- architecture-agent minimale;
- render-agent;
- retrieval logs.

**Gate:** output JSON rigido, limiti rispettati, nessuna prosa lunga.

### P6 — MCP server e tool

**Obiettivo:** esporre memoria a Codex via MCP stdio.

**Task:**

- server MCP;
- tool schemas;
- handlers `head/query/duplicates/frame/refresh/diff`;
- `visualFrame`/`frame` come `{ svg, png, map }` con PNG nullable;
- gestione repo non inizializzata;
- error handling compatto.

**Gate:** tool list corretta; tutti i tool rispondono con JSON prevedibile.

### P7 — Hook bundle

**Obiettivo:** collegare memoria al lifecycle Codex senza invasività.

**Task:**

- `hooks/hooks.json`;
- hook scripts TypeScript;
- stdin JSON parsing robusto;
- dirty flag;
- refresh changed-only su Stop se abilitato;
- loop guard env + lock file;
- log.

**Gate:** hook non crashano con input vuoto; Stop non crea loop; auto-refresh disattivabile.

### P8 — Custom subagents templates

**Obiettivo:** installare template read-only opzionali.

**Task:**

- templates TOML;
- `pmem agents install --scope project`;
- `pmem agents list`;
- no overwrite senza `--force`;
- documentazione prompt di invocazione.

**Gate:** file generati in `.codex/agents/`; istruzioni read-only; non cuore runtime.

### P9 — Test, fixture e demo

**Obiettivo:** validazione end-to-end su fixture realistica.

**Task:**

- fixture `nest-basic`;
- test scanner/schema/AST/renderer/agent/MCP;
- demo script;
- acceptance finale.

**Gate:** `npm test` verde; demo produce `current.svg` e `current.map.json`; `current.png` è accettato se export disponibile, altrimenti warning `png_export_failed`; query compatta; nessun path assoluto in output pubblico.

---

## 6. Backlog ticket

```text
PMEM-001..006  Plugin packaging
PMEM-010..018  Runtime e store
PMEM-020..028  Indexing
PMEM-030..038  Visual memory
PMEM-040..047  Agents and retrieval
PMEM-050..058  MCP
PMEM-060..067  Hooks and subagents
PMEM-070..077  Tests and demo
```

Il dettaglio dei ticket è in `03_IMPLEMENTATION_PLAN_v0.1_REFINED.md`.

---

## 7. Acceptance finale v0.1

CLI:

```bash
pmem init
pmem index
pmem render
pmem head --json
pmem query "aggiungi controllo accesso abbonamento sospeso" --json
pmem duplicates --kind service "validazione diritto accesso" --json
pmem refresh --changed-only
```

MCP:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

Risultati obbligatori:

- memoria locale creata nel repository corretto;
- file TS/JS indicizzati;
- simboli principali estratti;
- `current.svg` e `current.map.json` esistono; `current.png` esiste solo se export PNG riesce, altrimenti `png_export_failed` è warning non fatale;
- `memory.query` restituisce pochi file esatti;
- `memory.duplicates` segnala duplicati plausibili;
- `memory.refresh` aggiorna changed-only;
- hook non bloccano flusso normale;
- subagenti opzionali read-only;
- contesto compatto.

---

## 8. Rischi bloccanti e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Skill scambiata per prodotto | skill solo workflow, operazioni via MCP/CLI |
| Hook invasivi | dirty flag, changed-only, no-op sicuri, config disable |
| Subagenti costosi/non deterministici | runtime rule-based, subagenti opzionali read-only |
| SVG fragile | layout semplice a griglia, map JSON obbligatoria come contratto |
| AST incompleto | best-effort, warning, fallback path/name search |
| PNG export fragile | SVG/map primari, PNG best-effort nullable |
| Config Codex/plugin evolve | manifest isolato, `pmem doctor`, docs versionate |

---

## 9. Regola finale di esecuzione

La v0.1 non deve essere elegante prima di essere affidabile.

Priorità:

```text
1. installabile
2. buildabile
3. inizializza memoria locale
4. indicizza file reali
5. genera frame visuale leggibile
6. espone MCP tools compatti
7. blocca duplicati evidenti
8. aggiorna changed-only
9. ha test e fixture
10. solo dopo: migliora estetica e semantica
```
