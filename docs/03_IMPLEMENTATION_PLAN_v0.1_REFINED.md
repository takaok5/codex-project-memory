# Codex Project Memory Plugin — implementation plan raffinato v0.1

**Stato:** implementation plan raffinato global-pass5 autonomous-ready.  
**Fonte operativa:** `01_EXECUTION_PLAN_v0.1_CONSOLIDATED.md`.  
**Scopo:** trasformare il piano in ticket e pass Codex eseguibili, con gate chiari.  
**Nota:** non implementare tutto in un unico passaggio.

---

## 1. Sequenza consigliata

```text
Pass 1: P0 + P1      PMEM-001..006
Pass 2: P2           PMEM-010..018
Pass 3: P3           PMEM-020..028
Pass 4: P4           PMEM-030..038
Pass 5: P5           PMEM-040..047
Pass 6: P6           PMEM-050..058
Pass 7: P7 + P8      PMEM-060..067
Pass 8: P9           PMEM-070..077
```

Ogni pass termina con:

```bash
npm run build
npm test
```

Dopo P2:

```bash
node dist/cli/pmem.js doctor --json
node dist/cli/pmem.js head --json
```

Dopo P4:

```bash
node dist/cli/pmem.js init --json
node dist/cli/pmem.js index --json
node dist/cli/pmem.js render --json
node dist/cli/pmem.js frame current --json
```

`current.png` non è un gate hard: il gate P4 richiede `current.svg` e `current.map.json`; PNG può essere `null` con warning.

### 1.1 Protocollo per agente poco intelligente

Ogni pass deve seguire lo stesso ciclo, senza deviare:

```text
1. leggere il prompt del pass in 11
2. leggere il blocco Pn corrispondente in 01
3. leggere le righe funzione Pn in 04
4. leggere `14_IMPLEMENTATION_MATRIX.md` per file/export/test del pass
5. leggere `16_PUBLIC_SCHEMAS.md` per ogni output pubblico toccato
6. leggere il contratto specialistico della fase
7. creare solo i file richiesti dal pass
6. implementare tipi pubblici prima delle funzioni
7. implementare funzioni pure prima delle funzioni con side effect
8. implementare secondo template statici di `15` quando applicabile
9. aggiungere test minimi indicati dal contratto e da `14`/`17`
10. eseguire npm run build
11. eseguire npm test
12. verificare acceptance della fase in 10
```

Regole di completamento per ticket:

- un ticket non è chiuso se espone una funzione pubblica non presente in `04`;
- un ticket non è chiuso se l'output JSON differisce dagli esempi di `06`/`07`;
- un ticket non è chiuso se scrive file senza path safety o atomic write dove richiesto;
- un ticket non è chiuso se richiede decisioni non documentate; in quel caso usare i default di `01` e `13`;
- helper privati sono ammessi solo se restano nel modulo e non diventano API usata da CLI/MCP senza contratto.

---

## 2. Ticket dettagliati

### EPIC A — Plugin packaging

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-001 | Scaffold TypeScript | `package.json`, `tsconfig.json`, `vitest.config.ts` | build verde |
| PMEM-002 | CLI bootstrap | `bin/pmem`, `src/cli/pmem.ts`, shared errors | `--help`/`--version` rispondono |
| PMEM-003 | Manifest plugin | `.codex-plugin/plugin.json` | JSON valido, path relativi |
| PMEM-004 | MCP config | `.mcp.json` | stdio, punta a `dist/mcp/server.js` |
| PMEM-005 | Skill skeleton | `skills/repo-memory/SKILL.md` | workflow corretto, no memoria progetto |
| PMEM-006 | Assets/README/lifecycle docs | asset placeholder, README install/lifecycle | path coerenti |

### EPIC B — Runtime e store

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-010 | Repo root locator | `project-locator.ts` | trova root/fallback |
| PMEM-011 | Memory paths | `memory-paths.ts` | path normalizzati, no traversal |
| PMEM-012 | Config loader | `config-loader.ts` | default + merge + schema validation |
| PMEM-013 | SQLite schema | `schema.sql` | schema v1, FK on, no `features` |
| PMEM-014 | Store repositories | `repositories/*.ts` | CRUD/replace minimi |
| PMEM-015 | State machine | project_state helpers | transizioni valide |
| PMEM-016 | CLI init | `commands/init.ts` | crea memoria idempotente |
| PMEM-017 | CLI doctor | `commands/doctor.ts` | diagnostica JSON read-only |
| PMEM-018 | CLI head | `commands/head.ts` | head compatto anche pre-init |

### EPIC C — Indexing

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-020 | File scanner | `scan.ts` | include/exclude ok, memory dir esclusa |
| PMEM-021 | Hash changed-only | `hash.ts` | skip invariato |
| PMEM-022 | Classifier | `language.ts` | test/generated/language |
| PMEM-023 | Module inference | `module-inference.ts` | module id stabile |
| PMEM-024 | AST symbols | `ast-indexer.ts` | class/function/interface/type/enum |
| PMEM-025 | Import/export edges | `dependency-graph.ts` | solo edge risolti |
| PMEM-026 | NestJS routes | `route-indexer.ts` | controller base |
| PMEM-027 | Warning capture/lifecycle | warnings repository | parser/unresolved warning dedupe |
| PMEM-028 | CLI scan/index | commands | scan/index JSON, hard delete cascade |

### EPIC D — Visual memory

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-030 | Graph builder | `graph-builder.ts` | graph stabile |
| PMEM-031 | Generated JSON | `generated/*.json` | output compatto, no code dump |
| PMEM-032 | SVG template | `svg-template.ts` | escape testo |
| PMEM-033 | Overview frame | `render-overview.ts` | leggibile |
| PMEM-034 | Modules frame | `render-modules.ts` | moduli/edge |
| PMEM-035 | Duplicates/risks | frames placeholder data-driven | no hardcode finto |
| PMEM-036 | PNG export | `svg-to-png.ts` | best-effort, nullable |
| PMEM-037 | Sidecar map | map JSON | id/bbox/path/commands |
| PMEM-038 | CLI render/frame | commands | produce SVG/map, PNG opzionale |

### EPIC E — Agents and retrieval

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-040 | Agent schemas | `types.ts` | Zod input/output |
| PMEM-041 | Dispatcher | `dispatcher.ts` | route agent |
| PMEM-042 | Retrieval-agent | `retrieval-agent.ts` | scoring documentato, limiti rispettati |
| PMEM-043 | Duplicate-agent | `duplicate-agent.ts` | thresholds high/medium/low |
| PMEM-044 | Drift-agent | `drift-agent.ts` | dirty/stale warnings |
| PMEM-045 | Architecture-agent | `architecture-agent.ts` | constraints/warnings da config |
| PMEM-046 | Render-agent | `render-agent.ts` | wrapper renderer con PNG nullable |
| PMEM-047 | Retrieval logs | store write | JSON compatto |

### EPIC F — MCP

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-050 | Server bootstrap | `server.ts` | stdio avvia |
| PMEM-051 | Tool schemas | `tool-schemas.ts` | Zod valido |
| PMEM-052 | `memory.head` | `tools/head.ts` | not_initialized ok |
| PMEM-053 | `memory.query` | `tools/query.ts` | usa dispatcher |
| PMEM-054 | `memory.duplicates` | `tools/duplicates.ts` | usa duplicate-agent |
| PMEM-055 | `memory.frame` | `tools/frame.ts` | `{ svg, png, map }` |
| PMEM-056 | `memory.refresh` | `tools/refresh.ts` | changed-only default |
| PMEM-057 | `memory.diff` | `tools/diff.ts` | snapshot/file diff minimo |
| PMEM-058 | MCP error handling | shared errors/server mapper | no crash, no stdout prose |

### EPIC G — Supported lifecycle and subagents

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-060 | Skill lifecycle | `skills/repo-memory/SKILL.md` | mapping lifecycle supportato |
| PMEM-061 | Implicit invocation | `skills/repo-memory/agents/openai.yaml` | `allow_implicit_invocation=true` |
| PMEM-062 | MCP dependencies | agent YAML | sei tool memory.* dichiarati |
| PMEM-063 | Refresh closeout | `memory.refresh` | changed-only/render default |
| PMEM-064 | Diff closeout | `memory.diff` | delta compatto |
| PMEM-065 | Agent templates | TOML templates | read-only, MCP-first |
| PMEM-066 | Agents install/list | CLI commands | no overwrite senza force |
| PMEM-067 | Trust docs | README | istruzioni chiare |

### EPIC H — Tests and demo

| Ticket | Titolo | Output | Gate |
|---|---|---|---|
| PMEM-070 | Fixture nest-basic | test fixture | repo realistica |
| PMEM-071 | Store tests | vitest | schema/repository/FK/no-features |
| PMEM-072 | Scanner tests | vitest | include/exclude/hash |
| PMEM-073 | AST tests | vitest | symbols/routes/unresolved warning |
| PMEM-074 | Renderer tests | vitest | determinismo/map/PNG nullable |
| PMEM-075 | Agent tests | vitest | retrieval/duplicate scoring |
| PMEM-076 | MCP tests | vitest/integration | handlers/error mapping |
| PMEM-077 | Demo walkthrough | docs/script | scenario completo |

---

## 3. Regole di modifica per Codex

Per ogni ticket Codex deve:

1. leggere solo la fase e i contratti correlati;
2. implementare file previsti, senza espandere perimetro;
3. mantenere output JSON compatto;
4. aggiornare test minimi;
5. non introdurre feature post-MVP;
6. non introdurre comandi vietati;
7. non creare path assoluti in output pubblico;
8. chiudere con build/test.

---

## 4. Merge policy interna

Un pass è mergeabile se:

- non rompe pass precedenti;
- non lascia TODO critici in percorsi runtime;
- aggiunge test per funzioni con side effect;
- non introduce letture/scritture fuori path consentiti;
- mantiene compatibility con Node.js 20+ ESM;
- non introduce tabelle/comandi/agent behavior fuori v0.1;
- aggiorna documentazione solo quando cambia un contratto pubblico.

---

## 5. Sequenza operativa compatta

```text
P0/P1: plugin esiste e si builda
P2: memoria locale esiste
P3: memoria strutturale esiste
P4: memoria visuale SVG/map esiste, PNG opzionale
P5: retrieval/duplicate rule-based esistono
P6: Codex può usarla via MCP
P7: lifecycle aggiorna senza invasività
P8: subagenti opzionali installabili
P9: demo end-to-end provata
```
