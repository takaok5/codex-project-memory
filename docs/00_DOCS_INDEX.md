# Codex Project Memory Plugin — indice documenti Codex-ready v0.1

**Stato:** indice raffinato global-pass5 autonomous-ready; documentazione pronta per implementazione controllata, nessun codice prodotto.  
**Fonte operativa primaria:** `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md`.  
**Set canonico:** documenti `00`–`17`.  
**Perimetro bloccato:** TypeScript/JavaScript, SQLite locale, SVG deterministico, map JSON obbligatoria, PNG fallback nullable, micro-agent interni rule-based, subagenti Codex opzionali.

---

## 1. Gerarchia delle fonti

Codex deve risolvere conflitti documentali in questo ordine:

1. `docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` — fonte operativa vincolante.
2. `docs/04_FUNCTION_CONTRACTS.md` — contratti di modulo/funzione/tipi/side effects vincolanti.
3. `docs/16_PUBLIC_SCHEMAS.md` — shape pubbliche JSON/config/errori/warning/map/snapshot vincolanti.
4. `docs/05_DATA_MODEL_SQLITE.md` — schema dati, repository e lifecycle DB vincolanti.
5. `docs/06_CLI_CONTRACTS.md` e `docs/07_MCP_TOOL_CONTRACTS.md` — comportamento interfacce pubbliche.
6. `docs/08_RENDERER_VISUAL_CONTRACT.md` e `docs/09_AGENTS_AND_HOOKS_CONTRACT.md` — contratti specialistici runtime.
7. `docs/14_IMPLEMENTATION_MATRIX.md`, `docs/15_STATIC_FILE_TEMPLATES.md`, `docs/17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md` — overlay meccanico per file-per-pass, template e golden fixture.
8. `docs/10_TEST_PLAN_AND_ACCEPTANCE.md` — acceptance che chiude ogni pass.
9. `docs/11_CODEX_IMPLEMENTATION_PROMPTS.md`, `docs/12_DEMO_SCENARIO.md`, `docs/13_OPEN_ITEMS_AND_GUARDS.md` — strumenti operativi e guardrail.
10. Qualsiasi file fuori dal set canonico `00`–`17` — non fonte normativa per la v0.1, salvo aggiornamento esplicito dell'indice.

Nota: negli archivi di consegna i file possono stare alla root; nel repository finale devono stare in `docs/` mantenendo gli stessi nomi.

---

## 2. Ordine di lettura per Codex

Per implementare senza saturare contesto:

```text
1. docs/01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md
2. docs/11_CODEX_IMPLEMENTATION_PROMPTS.md, solo prompt del pass corrente
3. docs/04_FUNCTION_CONTRACTS.md, solo sezione della fase corrente
4. docs/05_DATA_MODEL_SQLITE.md, se fase P2+
5. docs/06_CLI_CONTRACTS.md o docs/07_MCP_TOOL_CONTRACTS.md, se la fase tocca interfacce
6. docs/08_RENDERER_VISUAL_CONTRACT.md, se fase P4
7. docs/09_AGENTS_AND_HOOKS_CONTRACT.md, se fase P5/P7/P8
8. docs/14_IMPLEMENTATION_MATRIX.md, per file/export/test del pass corrente
9. docs/15_STATIC_FILE_TEMPLATES.md, se il pass crea artifact statici
10. docs/16_PUBLIC_SCHEMAS.md, se il pass produce JSON pubblico
11. docs/17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md, se il pass tocca fixture/demo/lifecycle
12. docs/10_TEST_PLAN_AND_ACCEPTANCE.md, prima di chiudere ogni pass
```

Codex non deve leggere tutti i documenti in ogni pass. Deve leggere solo la fase corrente e i contratti dei file che sta creando.

---

## 3. Documenti canonici

| Documento | Scopo | Quando usarlo |
|---|---|---|
| `00_DOCS_INDEX.md` | Indice e gerarchia fonti | Prima di partire o in caso di conflitto |
| `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md` | Piano operativo autoritativo P0–P9 | Sempre, in ogni pass |
| `02_SPEC_v0.1_REFINED.md` | Specifica architetturale stretta | Per capire principi e non-obiettivi |
| `03_IMPLEMENTATION_PLAN_v0.1_REFINED.md` | Piano implementativo per fasi/ticket | Per pianificare pass Codex |
| `04_FUNCTION_CONTRACTS.md` | Tipi, moduli e funzioni | Prima di scrivere codice |
| `05_DATA_MODEL_SQLITE.md` | Schema SQLite, repository, invarianti dati | P2 e oltre |
| `06_CLI_CONTRACTS.md` | Comandi `pmem`, input/output, exit code | P0–P8 |
| `07_MCP_TOOL_CONTRACTS.md` | Tool MCP, JSON schema, errori | P6 e oltre |
| `08_RENDERER_VISUAL_CONTRACT.md` | SVG/map/PNG deterministici | P4 e oltre |
| `09_AGENTS_AND_HOOKS_CONTRACT.md` | Micro-agent, subagenti opzionali, lifecycle supportato | P5, P7, P8 |
| `10_TEST_PLAN_AND_ACCEPTANCE.md` | Strategia test, fixture, acceptance | In chiusura di ogni pass |
| `11_CODEX_IMPLEMENTATION_PROMPTS.md` | Prompt pronti per Codex per ogni pass | Esecuzione guidata |
| `12_DEMO_SCENARIO.md` | Scenario demo end-to-end | P9 e validazione finale |
| `13_OPEN_ITEMS_AND_GUARDS.md` | Decisioni rinviate e guardrail | Prima di estendere oltre v0.1 |
| `14_IMPLEMENTATION_MATRIX.md` | Matrice file-per-pass, export ammessi, test e gate | In ogni pass prima di scrivere codice |
| `15_STATIC_FILE_TEMPLATES.md` | Template completi per artifact statici P0/P1/P8 | Quando si creano package/plugin/MCP/skill/subagent template |
| `16_PUBLIC_SCHEMAS.md` | Schema pubblici JSON, config, errori, warning, map e snapshot | Ogni volta che si produce output pubblico o config |
| `17_GOLDEN_FIXTURES_AND_EXPECTED_OUTPUTS.md` | Fixture canonica, DB rows attese, golden CLI/MCP/lifecycle | P3–P9 e validazione finale |

---

## 4. Regole dure per Codex

1. Non implementare codice se il pass corrente non è documentato.
2. Non introdurre dipendenze fuori perimetro senza aggiornare documentazione e motivazione.
3. Non usare embedding/vector DB nella v0.1.
4. Non rendere i subagenti Codex parte del runtime obbligatorio.
5. Non fare scan pesanti su prompt start; usare `memory.head` come controllo leggero.
6. Non leggere direttamente `memory.db` da Codex: usare MCP.
7. Non creare nuovi service/controller/DTO/route/table/module senza passare da `memory.duplicates`.
8. Non bloccare la memoria se PNG export fallisce: SVG e map JSON sono primari.
9. Non restituire context pack lunghi: pochi file, simboli mirati, warning utili.
10. Non trasformare la skill in prodotto: la skill è solo manuale operativo.
11. Non creare tabella `features`, vector table, source chunk table o soft delete file in v0.1.
12. Non persistire path assoluti in DB, generated JSON, CLI output o MCP output.

---

## 5. Stato pronto per implementazione

La documentazione è pronta quando:

- ogni fase P0–P9 ha task, file, DoD e test;
- ogni modulo/funzione pianificata ha signature e contratto;
- SQLite schema e repository sono definiti;
- CLI e MCP hanno input/output stabili;
- renderer ha contratto deterministico con PNG nullable;
- micro-agent, lifecycle skill/MCP e subagenti sono separati;
- demo e acceptance sono riproducibili;
- open items non bloccanti sono separati dallo scope v0.1.

---

## 6. Modalità agente stupido / autonomous-ready

Questa documentazione deve poter essere usata da un agente Codex con bassa capacità di inferenza. Per questo valgono queste regole operative:

1. **Niente implementazione one-shot.** L'agente deve eseguire i pass di `11_CODEX_IMPLEMENTATION_PROMPTS.md` nell'ordine indicato.
2. **Niente domande per default già chiusi.** Se un dettaglio ha un default in `01`, `04`, `06`, `08`, `09` o `13`, l'agente deve usare quel default.
3. **Niente interpretazione libera.** Se una funzione, un tipo pubblico, un comando, un tool MCP, una tabella o un side effect non è documentato, l'agente non deve inventarlo. Può creare solo helper privati locali al modulo, senza cambiare API pubblica.
4. **Contratti prima del codice.** Se durante sviluppo serve una nuova API pubblica, l'agente aggiorna prima il documento canonico competente e poi implementa. Per file/export/test deve aggiornare anche `14_IMPLEMENTATION_MATRIX.md`; per output pubblico deve aggiornare `16_PUBLIC_SCHEMAS.md`.
5. **Un solo motivo di stop tecnico.** L'agente si ferma solo se trova un conflitto non risolvibile con la gerarchia fonti di sezione 1. In quel caso deve riportare file, sezione e decisione minima proposta.
6. **Output pubblico sempre validabile.** Ogni CLI/MCP/generated output deve essere confrontabile con esempi e shape presenti nei contratti.
7. **Test come completamento del task.** Un pass non è completo senza build, test e acceptance della fase.

Default da usare senza chiedere conferma:

```text
package name: codex-project-memory
versione corrente: 0.2.0
binario CLI: pmem
MCP server name: project-memory
runtime: Node.js 20+ ESM
linguaggi indicizzati: TypeScript/JavaScript
store: better-sqlite3 locale
renderer: SVG deterministico + map JSON obbligatoria
PNG: best-effort nullable
subagenti: opzionali, read-only, mai core path
```

Criterio finale: se un agente riesce a seguire `11_CODEX_IMPLEMENTATION_PROMPTS.md` e `14_IMPLEMENTATION_MATRIX.md` pass-by-pass senza cercare decisioni fuori dai documenti `00`–`17`, la documentazione è considerata autonomous-ready.
