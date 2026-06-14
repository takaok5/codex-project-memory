# Codex Project Memory Plugin — agenti e lifecycle supportato v0.2

**Stato:** contratto agenti/lifecycle raffinato global-pass5 autonomous-ready, allineato a `04`, `06`, `07` e `08`.
**Regola chiave:** micro-agent interni e subagenti Codex opzionali sono due livelli diversi. I micro-agent sono runtime; i subagenti sono template read-only e non sono core path.

---

## 0. Decisioni vincolanti agenti/lifecycle

1. I micro-agent sono rule-based e non chiamano modelli esterni.
2. Il dispatcher valida input e output con schema typed.
3. Retrieval e duplicate usano scoring deterministico documentato, non euristiche libere.
4. Nessun agente modifica codice sorgente.
5. Nessun micro-agent invoca subagenti Codex.
6. Il plugin installabile non dichiara hook: il lifecycle usa skill implicita e MCP tools.
7. `skills/repo-memory/agents/openai.yaml` deve usare `allow_implicit_invocation=true`.
8. Il lifecycle deve preferire `memory.agent` e mantenere i sei tool granulari come fallback/debug.
9. `memory.agent` puo inizializzare e refreshare solo `.codex/memory/**`, mai codice sorgente.
10. Subagenti installati in `.codex/agents/` sono read-only e opzionali.

---

## 1. Micro-agent interni runtime

Vivono in `src/agents/` e sono invocati da CLI/MCP. Producono JSON compatto, non prosa libera.

### 1.0 `project-agent`

Orchestratore rule-based condiviso da `pmem agent run` e `memory.agent`.

Flow:

```text
head -> optional init -> optional refresh -> query -> optional duplicates -> optional frame/diff
```

Regole:

- `allowInit=true` consente init automatico di `.codex/memory`;
- `allowRefresh=true` consente refresh/render changed-only;
- `phase="pre_create"` richiede `artifact.kind`;
- duplicate high produce `status="blocked"` e `verdict="extend_existing_artifact"`;
- non modifica mai file sorgente.

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

## 4. Supported lifecycle

Codex app plugin validation does not accept plugin-declared hooks in v0.2 packaging. The supported replacement is the `repo-memory` skill with implicit invocation plus `memory.agent` and the project-memory MCP tools.

Required agent YAML:

```yaml
policy:
  allow_implicit_invocation: true
dependencies:
  tools:
    - memory.agent
    - memory.head
    - memory.query
    - memory.duplicates
    - memory.frame
    - memory.refresh
    - memory.diff
```

---

## 5. Lifecycle mapping

```text
Prompt start -> memory.agent phase=pre_task
Implementation intent -> memory.agent phase=pre_task
New artifact intent -> memory.agent phase=pre_create with artifact
After source changes -> memory.agent phase=post_change
Visual orientation -> memory.agent phase=orient
Review/closeout -> memory.agent phase=review
```

---

## 6. Lifecycle invarianti

1. Non richiede hook plugin o campi manifest non supportati.
2. Usa solo output MCP typed, mai `CliResult` nei tool.
3. Non modifica codice sorgente dai tool memoria.
4. Non legge `.codex/memory/memory.db` direttamente.
5. Non esegue full scan pesanti su prompt start.
6. `memory.refresh` resta changed-only di default.
7. PNG resta opzionale; SVG e map JSON sono primari.
8. Subagenti opzionali restano read-only e MCP-first.

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
| Lifecycle skill | frontmatter valido, supported lifecycle documentato |
| Agent YAML | `allow_implicit_invocation=true`, `memory.agent` e tool granulari dichiarati |
| Lifecycle closeout | `memory.agent phase=post_change` usa refresh changed-only/render default |
| Agents install | no overwrite senza force |

---

## 10. Acceptance agenti/lifecycle v0.2

Accettabile solo se:

1. retrieval e duplicate sono deterministici e testati;
2. duplicate high non consente creazione nuovo artefatto;
3. context pack è compatto e senza codice sorgente;
4. nessun agente richiede LLM/embedding/subagente;
5. subagenti sono opzionali, read-only, MCP-first;
6. skill lifecycle documenta `memory.agent` come entrypoint e i tool granulari come fallback;
7. agent YAML abilita invocazione implicita;
8. nessun hook plugin è richiesto o dichiarato;
9. `memory.agent phase=post_change` è il closeout supportato dopo modifiche sorgente;
10. nessun output pubblico contiene path assoluti o dump sorgente.
