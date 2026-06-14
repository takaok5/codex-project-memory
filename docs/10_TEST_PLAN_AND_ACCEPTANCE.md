# Codex Project Memory Plugin — test plan e acceptance v0.1

**Stato:** test plan raffinato global-pass5 autonomous-ready, allineato ai contratti `04`–`09`.  
**Obiettivo:** dimostrare che il plugin è installabile, buildabile, affidabile e utile a Codex prima di passare oltre v0.1.

---

## 0. Regole generali di test

1. Ogni pass termina con `npm run build` e `npm test`.
2. I test devono usare fixture temporanee e non scrivere fuori dalla root fixture.
3. Output JSON CLI/MCP/generated devono essere validati come shape, non solo come stringhe.
4. Tutti i path pubblici attesi nei test sono relativi POSIX.
5. `current.svg` e `current.map.json` sono obbligatori nei test render; `current.png` è opzionale.
6. PNG failure è successo con warning `png_export_failed` se SVG/map sono validi.
7. Nessun test v0.1 richiede cloud, embeddings, vector DB, LLM o subagenti installati.
8. Test snapshot/diff non devono contenere codice sorgente esteso.

---

## 1. Test pyramid v0.1

```text
Unit test
  shared, config, path, parser helper, repository, scoring, renderer model

Integration test
  init, DB schema, scan/index fixture, render, CLI JSON, MCP handlers, lifecycle skill

End-to-end demo
  fixture nest-basic con query/duplicates/refresh/diff
```

---

## 2. Fixture principale

```text
test/fixtures/nest-basic/
  package.json
  src/auth/auth.service.ts
  src/auth/auth.controller.ts
  src/access/access.service.ts
  src/access/access.controller.ts
  src/subscriptions/subscription.service.ts
  src/turnstile/turnstile.service.ts
  src/audit/audit.service.ts
  src/access/access.service.spec.ts
```

Dominio fixture:

- `AccessService` decide allow/deny.
- `SubscriptionService` possiede stato abbonamento.
- `TurnstileService` apre fisicamente, non decide policy.
- `AuditService` registra aperture.
- Controller non contiene logica dominio.

---

## 3. Test per fase

### P0/P1

```bash
npm install
npm run build
npm test
node dist/cli/pmem.js --help
node dist/cli/pmem.js --version
```

Test:

- `VERSION` non vuoto;
- CLI help/version;
- manifest JSON valido;
- `.mcp.json` valido e stdio-only;
- skill non contiene memoria progetto;
- skill lifecycle contiene mapping supportato e agent YAML abilita invocazione implicita;
- asset placeholder presenti se documentati.

### P2

Test:

- `pmem init --json` crea struttura `.codex/memory`;
- `pmem init` idempotente;
- `pmem doctor --json` segnala non-init/config invalida/DB ok;
- `pmem head --json` restituisce `not_initialized` o stato compatto;
- `openMemoryDb()` abilita `PRAGMA foreign_keys=ON`;
- `ensureSchema()` imposta schema v1/user_version;
- schema contiene solo tabelle core documentate;
- tabella `features` assente;
- transazioni rollback su errore;
- path DB/output sono relativi POSIX dove pubblici.

### P3

Test:

- scanner include/exclude;
- `.codex/memory/**` escluso;
- hash stabile;
- classificazione TS/JS/test/generated;
- AST estrae class/function/method/interface/type/enum;
- NestJS route inference base;
- parser error -> warning;
- unresolved import -> warning `unresolved_import`, zero edge fittizio;
- changed-only skip;
- file cancellato -> hard delete cascade;
- warning lifecycle: due run identici non duplicano warning.

### P4

Test:

- generated JSON validi e senza path assoluti;
- SVG deterministico byte-for-byte;
- map JSON con id/bbox/paths/commands;
- map/SVG id coerenti;
- frame overview/modules/duplicates/risks/current;
- PNG disabilitato -> `png=null`, successo;
- PNG failure -> warning non fatale;
- frames table aggiornata con `png_path=NULL` ammesso;
- atomic write non lascia artifact finali corrotti.

### P5

Test:

- dispatcher valida input/output;
- agent sconosciuto -> `VALIDATION_ERROR`;
- retrieval rispetta maxFiles/maxSymbols/maxWarnings;
- retrieval scenario torna access/subscriptions/test;
- retrieval scoring ordinato deterministicamente;
- duplicate high risk su nuovo AccessValidationService;
- duplicate exact override;
- high risk non produce `create_new_artifact`;
- drift distingue dirty/stale/fresh/error;
- architecture include criticalRules senza inventarne;
- retrieval_logs scritto compatto;
- nessun agente usa LLM/embedding/subagenti.

### P6

Test:

- MCP server stdio smoke;
- tool list contiene esattamente 6 tool;
- `memory.head` non-init;
- `memory.query` usa dispatcher;
- `memory.duplicates` usa duplicate-agent;
- `memory.frame` restituisce `{ svg, png, map }` con `png` nullable;
- `memory.refresh` changed-only default;
- `memory.diff` minimal;
- error mapping solo server;
- nessun tool restituisce codice sorgente o path assoluti.

### P7/P8

Test:

- skill lifecycle documenta `memory.head/query/duplicates/frame/refresh/diff`;
- agent YAML contiene `allow_implicit_invocation=true`;
- agent YAML dichiara esattamente i sei tool MCP v0.1;
- `memory.refresh` resta changed-only/render default per closeout;
- nessun hook plugin è richiesto o impacchettato;
- `pmem agents install` crea TOML read-only;
- non overwrite senza `--force`;
- `pmem agents list` è read-only.

### P9

Test:

- demo completa su fixture;
- `npm test` verde;
- query e duplicate match attesi;
- render produce SVG/map; PNG opzionale;
- refresh changed-only non reindicizza tutto;
- diff mostra cambi minimi;
- acceptance CLI/MCP sotto rispettata.

---

## 4. Acceptance finale CLI

Un utente deve poter eseguire:

```bash
pmem init --json
pmem index --json
pmem render --json
pmem head --json
pmem query "aggiungi controllo accesso abbonamento sospeso" --json
pmem duplicates --kind service "validazione diritto accesso" --json
pmem refresh --changed-only --json
pmem frame current --json
pmem diff --json
```

Risultati:

- memoria creata in `.codex/memory`;
- DB con file/simboli/route;
- schema v1 e FK abilitati;
- nessuna tabella `features`;
- `current.svg` e `current.map.json` presenti;
- `current.png` opzionale, `png=null` accettato;
- query compatta e utile;
- duplicate guard segnala rischio;
- refresh changed-only non reindicizza tutto inutilmente;
- comandi vietati (`validate`, `summarize`, `server`, `sync`, `cloud`, `embeddings`) non esistono o falliscono come unknown/validation;
- nessun comando modifica codice sorgente.

---

## 5. Acceptance finale MCP

Codex deve poter chiamare:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
```

Con:

- output JSON compatto;
- errori recuperabili con `PmemErrorCode` canonico;
- `memory.head` funzionante anche prima di init;
- nessun accesso diretto a DB/generated JSON;
- nessun dump codice;
- `visualFrame` e `frame` con `png: string \| null`;
- `memory.refresh` changed-only per default.

---

## 6. Acceptance finale renderer

Renderer accettabile se:

```text
current.svg exists
current.map.json exists
current.png may exist or may be null/missing
frames table has svg_path/map_path not null
frames table allows png_path null
map JSON has id/bbox/path/commands
SVG deterministic test passes
PNG failure emits warning only
```

---

## 7. Metriche di qualità v0.1

| Metrica | Soglia |
|---|---|
| Build | 100% verde |
| Test unit/integration | 100% verde |
| Query context pack | <= maxFiles/maxSymbols/maxWarnings configurati |
| SVG determinismo | output identico a parità input |
| Lifecycle artifact validation failure | 0 |
| PNG failure | non fatale |
| Duplicate obvious service | high risk + extend existing |
| Non-init head | nessun crash |
| Path assoluti in output pubblico | 0 |
| Source code dump in MCP/context pack | 0 |
| Legacy/features table in schema nuovo | 0 |

---

## 8. Non-acceptance

La v0.1 non è accettabile se:

- richiede embeddings/vector DB;
- richiede subagenti Codex per funzionare;
- richiede LLM nella core path;
- la skill contiene memoria progetto;
- il lifecycle bypassa la skill/MCP e fa scansioni pesanti su prompt;
- il renderer usa immagini AI libere o layout random;
- Codex deve leggere `memory.db` direttamente;
- `memory.query` restituisce troppi file o codice;
- errori parser bloccano tutto l'index;
- PNG mancante fa fallire render/refresh con SVG/map validi;
- output pubblici contengono path assoluti;
- file cancellati restano come simboli/route stale dopo changed-only.

---

## 9. Autonomous-ready audit

Prima di consegnare la documentazione a un agente poco intelligente, questi controlli devono essere veri:

| Audit | Metodo | Pass/fail |
|---|---|---|
| Set canonico | archivio contiene documenti canonici `00`–`17` e nessun file legacy/intermedio | fail se file legacy/intermedi o mancano `14`–`17` |
| Fence Markdown | tutti i fence sono bilanciati | fail se blocchi rotti |
| SQL schema | blocchi SQL di `05` eseguibili su SQLite in-memory | fail su errore sintassi |
| Tipi referenziati | ogni tipo usato in signature di `04` è definito in `04` o nel contratto specialistico | fail se tipo fantasma |
| Scoring | pesi retrieval/duplicate identici in `04` e `09` | fail se divergono |
| PNG | nessuna acceptance richiede `current.png` obbligatorio | fail se PNG hard gate |
| DB | nessun documento richiede tabella `features`, vector, chunks o soft delete | fail se compare come core v0.1 |
| CLI/MCP | output visuale sempre `{ svg, png, map }` con `png` nullable | fail se shape diversa |
| Fixture | `12` contiene file fixture sufficienti per AST/routes/tests | fail se fixture è solo lista nomi |
| No source dump | context pack/MCP/generated JSON vietano codice sorgente esteso | fail se esempi lo includono |

Comando mentale per Codex prima di ogni pass:

```text
I can implement only what is in the current pass, with public types/functions from 04 and acceptance from 10. If something is missing, update docs first or keep it private/local.
```


---

## 10. Docs hardening overlay

Per chiudere la v0.1 autonomous-ready, i test devono usare anche:

```text
14_IMPLEMENTATION_MATRIX.md — file/export/test/gate per pass
15_STATIC_FILE_TEMPLATES.md — snapshot statici P0/P1/P8
16_PUBLIC_SCHEMAS.md — validazione output pubblico/config/map/snapshot
17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md — fixture, DB rows, golden CLI/MCP/lifecycle
```

Un test che confronta output pubblico deve validare lo schema di `16`; un test demo deve usare gli attesi di `17`.
