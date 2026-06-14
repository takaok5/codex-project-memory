# Codex Project Memory Plugin — open items e guardrail v0.1

**Stato:** guardrail raffinati global-pass5 autonomous-ready.  
Questo documento raccoglie ciò che è intenzionalmente rinviato o da verificare senza bloccare la v0.1.

---

## 1. Decisioni chiuse, non riaprire in v0.1

| Decisione | Stato |
|---|---|
| Plugin all-in-one, non skill standalone | chiusa |
| TypeScript/JavaScript only | chiusa |
| SQLite locale per repo | chiusa |
| Schema SQLite v1 senza `features` table | chiusa |
| File cancellati con hard delete cascade | chiusa |
| Unresolved imports come warning, non edge fittizi | chiusa |
| Warning lifecycle con dedupe/fingerprint | chiusa |
| SVG primario deterministico | chiusa |
| Map JSON obbligatoria | chiusa |
| PNG fallback best-effort e nullable | chiusa |
| Micro-agent interni rule-based | chiusa |
| Retrieval/duplicate scoring deterministico | chiusa |
| Subagenti Codex opzionali/read-only | chiusa |
| No embeddings/vector DB | chiusa |
| No LLM obbligatorio nella core path | chiusa |
| Hook conservativi con loop guard | chiusa |
| MCP come interfaccia operativa Codex | chiusa |
| Nessun comando modifica codice sorgente target | chiusa |
| Default autonomi package/toolchain di `01` | chiusa |
| `criticalRules` in config, non DB | chiusa |

---

## 2. Open items non bloccanti

| Item | Decisione v0.1 | Possibile post-MVP |
|---|---|---|
| Multi-language parsing | TS/JS only | tree-sitter multi-language |
| Monorepo avanzato | include/exclude + path/module hints | workspace graph |
| Semantic retrieval | lexical/rule-based | embeddings/vector DB opzionali |
| UI dashboard | nessuna | web dashboard |
| Visual timeline | frame statici + snapshot JSON | history/timeline interattiva |
| Team memory | locale per repo | shared/team store |
| GitHub integration | nessuna | PR comments/checks |
| Enterprise policies | guardrail base | policy engine |
| Auto-refactor | nessuno | guided refactor tools |
| PNG backend | best-effort con default implementativo | scelta ottimizzata sharp/playwright |
| Plugin packaging evolutivo | manifest isolato | adattatori per formato futuro |

---

## 3. Guardrail anti-scope-creep

Codex deve fermarsi e non implementare se sta per aggiungere:

- database vettoriale;
- chiamate modello obbligatorie;
- dashboard web;
- supporto Python/Java/C#/Go/Rust;
- scansioni automatiche pesanti da hook;
- scrittura codice da subagenti read-only;
- immagini AI generate liberamente;
- plugin marketplace remoto definitivo;
- memoria globale condivisa tra repository;
- cloud sync/login;
- comandi `pmem validate`, `pmem summarize`, `pmem server`, `pmem sync`, `pmem cloud`, `pmem embeddings`;
- tabella `features` nel DB v1;
- soft delete `deleted_at` per file v0.1;
- edge testuali per import unresolved in `symbol_edges`;
- PNG come requisito hard di successo render;
- cancellazione automatica dati memoria senza snapshot/backup esplicito.

---

## 4. Compatibilità e trust

Possibile area fragile: formati plugin/hook/subagent possono evolvere.

Mitigazione v0.1:

- manifest e template isolati;
- `pmem doctor` controlla file attesi;
- README indica che hook devono essere review/trusted;
- test non assumono marketplace remoto;
- path `${PLUGIN_ROOT}` centralizzati in pochi file;
- MCP stdio isolato da CLI human output;
- nessun output pubblico contiene path assoluti;
- hook disattivabili via config;
- subagenti non richiesti dal runtime.

---

## 5. Cosa chiedere all'utente solo dopo documentazione

Per un agente autonomo, questi punti **non bloccano** l'implementazione v0.1. Usare i default di `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md`:

| Domanda possibile | Default v0.1 | Quando riaprire |
|---|---|---|
| nome npm/package definitivo | `codex-project-memory` | release pubblica/npm |
| brand assets finali | placeholder locali | branding reale |
| Windows/WSL avanzato | path POSIX in output, test base path safety | hardening post-MVP |
| formato plugin Codex evoluto | manifest isolato `.codex-plugin/plugin.json` | se specifica ufficiale cambia |
| PNG backend | `sharp` opzionale best-effort | se PNG diventa requisito non-v0.1 |
| naming repo GitHub/npm | repo privata docs/implementazione | pubblicazione |
| release/versioning | `0.1.0` | post-MVP |

Un agente non deve fermarsi per queste domande. Deve usare il default e proseguire.

---

## 6. Regola di escalation

Se durante implementazione Codex trova un conflitto:

```text
01 execution plan > 04 function contracts > 05 data model > 06/07 interface contracts > 08/09 specialist contracts > 10 acceptance > 11 prompts > 12 demo > 13 guards
```

Se il conflitto riguarda una signature, un tipo o un side effect, aggiornare prima `04_FUNCTION_CONTRACTS.md`. Se riguarda lo schema DB, aggiornare prima `05_DATA_MODEL_SQLITE.md`. Non risolvere conflitti creando codice non documentato.
