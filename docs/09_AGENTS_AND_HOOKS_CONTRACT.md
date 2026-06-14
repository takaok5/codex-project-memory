# Codex Project Memory Plugin — agenti e hook v0.1

**Stato:** contratto agenti/hook raffinato global-pass5 autonomous-ready, allineato a `04`, `06`, `07` e `08`.  
**Regola chiave:** micro-agent interni e subagenti Codex opzionali sono due livelli diversi. I micro-agent sono runtime; i subagenti sono template read-only e non sono core path.

---

## 0. Decisioni vincolanti agenti/hook

1. I micro-agent in v0.1 sono rule-based e non chiamano modelli esterni.
2. Il dispatcher valida input e output con schema typed.
3. Retrieval e duplicate usano scoring deterministico documentato, non euristiche libere.
4. Nessun agente modifica codice sorgente.
5. Nessun micro-agent invoca subagenti Codex.
6. Gli hook sono conservativi: `UserPromptSubmit` non fa scan/index/render.
7. `Stop` usa loop guard env + lock file.
8. Hook stdout deve essere solo JSON compatto dove richiesto.
9. Hook errori/parsing falliti diventano no-op con warning.
10. Subagenti installati in `.codex/agents/` sono read-only e opzionali.

---

## 1. Micro-agent interni runtime

Vivono in `src/agents/` e sono invocati da CLI/MCP. Producono JSON compatto, non prosa libera.

### 1.1 `retrieval-agent`

#### Input

```json
{
  "intent": "aggiungi controllo accesso abbonamento sospeso",
  "maxFiles": 8,
  "maxSymbols": 12,
  "maxWarnings": 8,
  "includeVisualFrame": true
}
```

#### Strategia

```text
intent tokens
  -> module name/path match
  -> symbol name/fq_name match
  -> file path match
  -> route match
  -> test adjacency
  -> critical rules/module ownership
  -> active warnings relevance
  -> compact context pack
```

#### Scoring vincolante

Il punteggio per file/simbolo/modulo deve essere deterministico e documentato nei test. La v0.1 usa pesi interi o decimali semplici:

```text
+ exact module id/name token match        +40
+ symbol/fq_name token match              +30
+ path segment token match                +25
+ route path/method match                 +20
+ test adjacency to selected source file  +15
+ criticalRule/module owns match          +10
+ active warning relevance                +5
- generated file penalty                  -30
- test file penalty unless test intent    -10
```

Tie-break obbligatorio:

```text
score desc
path asc
symbol name asc
id asc
```

Tokenizzazione v0.1:

```text
lowercase
split on non-alphanumeric
split camelCase/PascalCase boundaries
no stemming
no embeddings
no locale-specific semantic expansion
```

#### Output

`RetrievalAgentOutput` da `04_FUNCTION_CONTRACTS.md`:

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

#### Side effects

- Scrive retrieval log compatto se DB disponibile.
- Non aggiorna index/render/state.

#### Invarianti

- Rispetta `maxFiles`, `maxSymbols`, `maxWarnings`.
- Non include codice sorgente.
- Non ritorna path assoluti.
- Include warning dirty/stale se stato memoria non fresh.
- Include `visualFrame` solo se richiesto e frame valido; `png` può essere `null`.

---

### 1.2 `duplicate-agent`

#### Input

```json
{
  "kind": "service",
  "intent": "AccessValidationService / verifica diritto accesso",
  "moduleId": "access",
  "proposedName": "AccessValidationService"
}
```

#### Strategia

```text
kind + normalized intent/proposedName
  -> exact symbol/name match
  -> path/name similarity
  -> module ownership overlap
  -> route/table/service naming overlap
  -> duplicate risk
  -> verdict + recommendation
```

#### Soglie vincolanti

```text
similarity >= 0.80 -> risk high   -> verdict extend_existing_artifact
similarity >= 0.45 -> risk medium -> verdict needs_human_review
similarity <  0.45 -> risk low    -> verdict create_new_artifact
```

Override obbligatorio:

```text
same ArtifactKind + same normalized proposedName/name + same moduleId -> high always
same route method+path or same table name -> high always
```

Formula similarity v0.1, uguale a `04_FUNCTION_CONTRACTS.md`:

```text
+0.35 same ArtifactKind
+0.25 same moduleId or same first path segment
+0.20 normalized name token overlap >= 0.50
+0.10 intent token overlap >= 0.35
+0.05 same route/table/domain noun token
+0.05 adjacent test or same controller/service pair
-0.20 clearly different module ownership from config.mustNot
clamp 0..1
```

Normalizzazione: lowercase, split non-alphanumeric, split camelCase/PascalCase, remove suffixes `service/controller/dto/module/repository` only for comparison, no stemming/embeddings.


#### Output

```json
{
  "risk": "high",
  "verdict": "extend_existing_artifact",
  "matches": [],
  "recommendation": "Estendere l'artefatto esistente invece di crearne uno nuovo."
}
```

#### Invarianti

- `risk="high"` non può mai avere `verdict="create_new_artifact"`.
- Match ordinati per `similarity desc`, poi `path asc`, poi `name asc`.
- Non modifica codice né crea ticket.
- Non usa `features` table.

---

### 1.3 `drift-agent`

**Responsabilità:** distinguere `fresh`, `dirty`, `stale`, `error`; suggerire `memory.refresh` o `pmem doctor`.

Output minimo:

```json
{
  "status": "dirty",
  "warnings": ["Memory is dirty after recent file changes."],
  "nextCommands": ["memory.refresh"]
}
```

**Side effects:** nessuno diretto salvo log compatto se dispatcher lo abilita.

---

### 1.4 `architecture-agent`

**Responsabilità v0.1:** applicare regole esplicite da config/moduli, non fare reasoning profondo.

Input sorgenti:

```text
ProjectMemoryConfig.modules[].owns
ProjectMemoryConfig.modules[].mustNot
ProjectMemoryConfig.modules[].dependencies
criticalRules
active warnings
retrieval/duplicate output
```

Output:

```json
{
  "constraints": [],
  "warnings": [],
  "recommendations": []
}
```

Invariante: non inventa regole non presenti in config o memoria strutturale.

---

### 1.5 `render-agent`

**Responsabilità:** wrapper controllato verso renderer.

Invarianti:

- non inventa dati visuali;
- usa solo graph/store/config;
- propaga `png_export_failed` come warning non fatale;
- ritorna frame ref con `png: string \| null`.

---

## 2. Dispatcher

### Signature

```ts
async function dispatchAgent<N extends AgentName>(
  ctx: AgentContext,
  name: N,
  input: AgentInput<N>
): Promise<AgentOutput<N>>
```

### Regole

- validazione input/output con Zod;
- output strict JSON;
- logging compatto;
- agent sconosciuto -> `VALIDATION_ERROR`;
- output invalido -> `AGENT_ERROR`;
- nessun agente modifica codice sorgente;
- nessun agente usa subagenti Codex come dipendenza runtime;
- tutti i path pubblici passano da normalizzazione POSIX;
- errori DB propagano `DB_ERROR`, non vengono convertiti in output parziali silenziosi.

### Test minimi

| Caso | Aspettativa |
|---|---|
| agent sconosciuto | `VALIDATION_ERROR` |
| input invalido | `VALIDATION_ERROR` |
| output invalido | `AGENT_ERROR` |
| retrieval fixture | file Access/Subscriptions/Test entro limiti |
| duplicate high | verdict extend existing |
| PNG null visualFrame | output valido |
| dirty memory | warning e next command |

---

## 3. Subagenti Codex opzionali

Installazione:

```bash
pmem agents install --scope project
```

Output:

```text
repo/.codex/agents/
  pmem-retriever.toml
  pmem-duplicate-checker.toml
  pmem-architecture-reviewer.toml
```

Regole:

- non installare se esistono già, salvo `--force`;
- non richiesti da CLI/MCP core;
- read-only per istruzioni;
- devono usare MCP, non DB diretto;
- devono restituire risultati concisi JSON-compatible.

### 3.1 `pmem-retriever.toml`

```toml
name = "pmem_retriever"
description = "Read-only project memory retrieval agent. Use it to locate exact modules, files and symbols before implementation."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use the project-memory MCP server first.
Call memory.head, then memory.query with the requested intent.
Return strict JSON-compatible findings: modules, files, symbols, constraints, warnings.
Do not edit files.
Do not dump broad repository context.
Do not read memory.db directly.
"""
```

### 3.2 `pmem-duplicate-checker.toml`

```toml
name = "pmem_duplicate_checker"
description = "Read-only duplicate guard agent. Use before creating services, controllers, DTOs, routes, tables, modules or utilities."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.duplicates with the requested artifact kind and intent.
Return risk, verdict, matches and recommendation.
Do not edit files.
Do not approve creation when high-risk matches exist.
Do not read memory.db directly.
"""
```

### 3.3 `pmem-architecture-reviewer.toml`

```toml
name = "pmem_architecture_reviewer"
description = "Read-only architecture review agent for checking constraints and memory drift."
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.head and memory.query.
Check whether proposed changes respect module ownership, critical rules and duplicate guard findings.
Return concise JSON-compatible warnings and recommendations.
Do not edit files.
Do not read memory.db directly.
"""
```

---

## 4. Hook bundle

Hook config punta a build output:

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ${PLUGIN_ROOT}/dist/hooks/user-prompt-submit.js" }] }],
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "node ${PLUGIN_ROOT}/dist/hooks/post-tool-use.js" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node ${PLUGIN_ROOT}/dist/hooks/stop.js" }] }],
    "SubagentStop": [{ "hooks": [{ "type": "command", "command": "node ${PLUGIN_ROOT}/dist/hooks/subagent-stop.js" }] }]
  }
}
```

Trust rule: installazione hook deve essere documentata e reviewable dall'utente.

---

## 5. Hook output canonico

Tutti gli hook ritornano `HookOutput`:

```ts
interface HookOutput {
  ok: true;
  action: "noop" | "additional_context" | "marked_dirty" | "refreshed" | "logged";
  additionalContext?: string;
  warnings: string[];
}
```

Regole:

- mai `ok:false` dagli hook v0.1;
- errori diventano `ok:true`, `action:"noop"`, warning compatto;
- stdout contiene solo JSON;
- warning non include stack trace o path assoluti.

---

## 6. Hook behavior

### `UserPromptSubmit`

```text
if no memory:
  additionalContext: suggest pmem init
if stale/dirty:
  additionalContext: memory stale/dirty warning + suggest memory.refresh when relevant
never run scan/index/render
never open many files
```

### `PostToolUse`

```text
inspect changed/written files when available
ignore .codex/memory/**
ignore node_modules/dist/build/coverage
if relevant source/config file changed:
  set project_state.memory_dirty = true
  set dirty_reason compactly
no refresh
```

### `Stop`

```text
if PMEM_HOOK_RUNNING=1:
  no-op warning hook_loop_guard_env
else if lock exists and not expired:
  no-op warning hook_loop_guard_lock
else if dirty and config.hooks.enabled and config.hooks.autoRefreshOnStop and changed files <= maxChangedFilesForStopRefresh:
  run pmem refresh --changed-only --json with loop guard
else:
  no-op
return valid JSON
```

### `SubagentStop`

```text
parse subagent output if structured
append retrieval log/warning if useful
never modify source files
never trigger refresh
```

---

## 7. Hook loop guard

`Stop` deve usare entrambi:

```text
if process.env.PMEM_HOOK_RUNNING === "1" -> no-op warning "hook_loop_guard_env"
if .codex/memory/cache/hook-refresh.lock exists and not expired -> no-op warning "hook_loop_guard_lock"
when invoking refresh from Stop, set PMEM_HOOK_RUNNING=1 and create lock with TTL 5 minutes
cleanup lock best-effort after refresh
```

Se la lock non è leggibile per errore FS, `Stop` deve preferire no-op sicuro con warning.

---

## 8. Hook invarianti

1. Devono accettare input vuoto.
2. Devono produrre JSON valido dove richiesto.
3. Non devono produrre plain text in stdout.
4. Non devono entrare in loop su `Stop`.
5. Non devono fare full scan pesante su prompt submit.
6. Devono essere disattivabili via config.
7. Devono loggare errori senza bloccare flusso normale.
8. Non devono modificare codice sorgente.
9. Devono ignorare `.codex/memory/**` come causa di dirty-loop.
10. Devono essere documentati come elementi da approvare/trustare dopo installazione.

---

## 9. Test richiesti

| Area | Test |
|---|---|
| Dispatcher | agent sconosciuto, schema input/output, output invalid |
| Retrieval | fixture intent trova Access/Subscriptions/Test entro limiti |
| Retrieval scoring | ordinamento deterministico, generated penalty |
| Duplicate | service simile produce high risk, exact override |
| Drift | dirty/stale/fresh/error |
| Architecture | criticalRules inclusi senza inventare regole |
| Render agent | delega renderer e propaga warning PNG |
| Subagent templates | sandbox read-only e MCP-first |
| Hook input | stdin vuoto/JSON invalido |
| Hook output | JSON compatto, no stack/path assoluti |
| UserPromptSubmit | no scan, suggerimento init/dirty |
| PostToolUse | dirty solo file repo, ignora memory dir |
| Stop | env guard, lock guard, refresh changed-only |
| SubagentStop | output strutturato/non strutturato |
| Agents install | no overwrite senza force |

---

## 10. Acceptance agenti/hook v0.1

Accettabile solo se:

1. retrieval e duplicate sono deterministici e testati;
2. duplicate high non consente creazione nuovo artefatto;
3. context pack è compatto e senza codice sorgente;
4. nessun agente richiede LLM/embedding/subagente;
5. subagenti sono opzionali, read-only, MCP-first;
6. hook non crashano con input vuoto o invalido;
7. `UserPromptSubmit` non fa scan/index/render;
8. `Stop` non crea loop;
9. hook sono disattivabili via config;
10. hook non scrivono testo libero su stdout.
