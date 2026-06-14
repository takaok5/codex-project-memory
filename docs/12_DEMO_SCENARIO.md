# Codex Project Memory Plugin — demo scenario v0.1

**Stato:** demo raffinata global-pass5 autonomous-ready, allineata a PNG nullable, duplicate thresholds, MCP/CLI compact JSON.  
**Scopo:** dimostrare il ciclo end-to-end con una fixture realistica NestJS-like.

---

## 1. Fixture

```text
test/fixtures/nest-basic/
  package.json
  src/auth/auth.service.ts
  src/auth/auth.controller.ts
  src/access/access.service.ts
  src/access/access.controller.ts
  src/access/access.service.spec.ts
  src/subscriptions/subscription.service.ts
  src/turnstile/turnstile.service.ts
  src/audit/audit.service.ts
```

### 1.1 Contenuto minimo dei file fixture

Questi file sono il contratto minimo della fixture. L'implementazione può aggiungere dettagli solo se non cambia gli attesi di query/duplicate.

`test/fixtures/nest-basic/package.json`:

```json
{
  "name": "nest-basic-fixture",
  "version": "0.0.0",
  "type": "module",
  "private": true
}
```

`src/subscriptions/subscription.service.ts`:

```ts
export type SubscriptionStatus = "active" | "suspended" | "expired";

export interface SubscriptionSnapshot {
  userId: string;
  status: SubscriptionStatus;
}

export class SubscriptionService {
  getSubscriptionForUser(userId: string): SubscriptionSnapshot {
    return { userId, status: "active" };
  }

  isSuspended(userId: string): boolean {
    return this.getSubscriptionForUser(userId).status === "suspended";
  }
}
```

`src/access/access.service.ts`:

```ts
import { SubscriptionService } from "../subscriptions/subscription.service";
import { AuditService } from "../audit/audit.service";

export interface AccessRequest {
  userId: string;
  gateId: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export class AccessService {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService
  ) {}

  canOpen(request: AccessRequest): AccessDecision {
    const subscription = this.subscriptions.getSubscriptionForUser(request.userId);
    if (subscription.status !== "active") {
      return { allowed: false, reason: "subscription_not_active" };
    }
    this.audit.recordAccessCheck(request.userId, request.gateId, true);
    return { allowed: true, reason: "ok" };
  }
}
```

`src/access/access.controller.ts`:

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { AccessService, AccessRequest } from "./access.service";

@Controller("access")
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post("open")
  open(@Body() request: AccessRequest) {
    return this.access.canOpen(request);
  }
}
```

`src/access/access.service.spec.ts`:

```ts
import { expect, it } from "vitest";
import { AccessService } from "./access.service";
import { SubscriptionService } from "../subscriptions/subscription.service";
import { AuditService } from "../audit/audit.service";

it("allows active subscriptions", () => {
  const subscriptions = new SubscriptionService();
  const audit = new AuditService();
  const service = new AccessService(subscriptions, audit);
  const result = service.canOpen({ userId: "u1", gateId: "g1" });
  expect(result.allowed).toBe(true);
});
```

`src/turnstile/turnstile.service.ts`:

```ts
import { AccessService, AccessRequest } from "../access/access.service";

export class TurnstileService {
  constructor(private readonly access: AccessService) {}

  open(request: AccessRequest): boolean {
    const decision = this.access.canOpen(request);
    if (!decision.allowed) return false;
    return true;
  }
}
```

`src/audit/audit.service.ts`:

```ts
export class AuditService {
  recordAccessCheck(userId: string, gateId: string, allowed: boolean): void {
    void `${userId}:${gateId}:${allowed}`;
  }
}
```

`src/auth/auth.service.ts`:

```ts
export interface AuthenticatedUser {
  id: string;
  roles: string[];
}

export class AuthService {
  currentUser(): AuthenticatedUser {
    return { id: "u1", roles: ["member"] };
  }
}
```

`src/auth/auth.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  me() {
    return this.auth.currentUser();
  }
}
```

Indicizzazione attesa dalla fixture:

```text
modules: access, subscriptions, turnstile, audit, auth
routes: POST /access/open, GET /auth/me
symbols: AccessService, AccessController, SubscriptionService, TurnstileService, AuditService, AuthService
warnings: unresolved_import per @nestjs/common ammesso; non deve diventare symbol_edges
```

---

## 2. Regole dominio fixture

```text
Access decide allow/deny.
Subscription owns status.
Turnstile executes only.
Controller must not contain domain logic.
Every physical open must be audited.
```

Queste regole vanno in `criticalRules` o in config module hints della fixture. Il sistema non deve inventare regole non presenti.

---

## 3. Comandi demo CLI

Da root della fixture:

```bash
pmem init --json
pmem doctor --json
pmem scan --json
pmem index --json
pmem render --json
pmem head --json
pmem query "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento è sospeso." --json
pmem duplicates --kind service "AccessValidationService / verifica diritto accesso" --json
pmem frame current --json
pmem refresh --changed-only --json
pmem diff --json
```

Comandi che non devono essere necessari:

```text
pmem validate
pmem summarize
pmem embeddings
pmem cloud
```

---

## 4. Sequenza demo MCP equivalente

```text
memory.head
memory.query(intent="Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento è sospeso.")
memory.duplicates(kind="service", intent="AccessValidationService / verifica diritto accesso")
memory.frame(frame="current")
memory.refresh(changedOnly=true, render=true, reason="demo")
memory.diff(from="previous", to="current")
```

`memory.head` deve funzionare anche se eseguito prima di `pmem init`, ritornando `status="not_initialized"` e suggerendo `pmem init --json`.

---

## 5. Output atteso `memory.query` / `pmem query`

La query deve restituire almeno questi file, rispettando `maxFiles`:

```text
src/access/access.service.ts
src/subscriptions/subscription.service.ts
src/access/access.service.spec.ts
```

File possibili ma non obbligatori se entro limite:

```text
src/turnstile/turnstile.service.ts
src/audit/audit.service.ts
src/access/access.controller.ts
```

Summary atteso:

```text
La modifica appartiene al modulo Access; Subscription fornisce lo stato abbonamento; Turnstile non deve contenere policy. Aggiornare test adiacente.
```

Constraints attesi:

```text
Access decide allow/deny.
Subscription owns status.
Turnstile executes only.
Controller must not contain domain logic.
Every physical open must be audited.
```

Forma minima del context pack:

```json
{
  "summary": "La modifica appartiene al modulo Access; Subscription fornisce lo stato abbonamento; Turnstile non deve contenere policy. Aggiornare test adiacente.",
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
```

`visualFrame.png` può essere path o `null`.

---

## 6. Output atteso `memory.duplicates` / `pmem duplicates`

Input:

```json
{
  "kind": "service",
  "intent": "AccessValidationService / verifica diritto accesso",
  "moduleId": "access",
  "proposedName": "AccessValidationService"
}
```

Output minimo:

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
      "similarity": 0.8,
      "reason": "same module and overlapping access validation responsibility"
    }
  ],
  "recommendation": "Estendere AccessService invece di creare un nuovo servizio di validazione accesso."
}
```

Invarianti demo:

- `risk="high"`;
- `verdict="extend_existing_artifact"`;
- non deve suggerire `create_new_artifact`;
- `similarity >= 0.80` oppure exact override documentato;
- nessun codice sorgente nel payload.

---

## 7. Output visuale atteso

Devono esistere:

```text
.codex/memory/current.svg
.codex/memory/current.map.json
.codex/memory/frames/overview.svg
.codex/memory/frames/overview.map.json
.codex/memory/frames/modules.svg
.codex/memory/frames/modules.map.json
```

Può esistere, ma non è obbligatorio:

```text
.codex/memory/current.png
.codex/memory/frames/*.png
```

Se PNG export fallisce o è disabilitato:

```json
{
  "png": null,
  "warnings": ["png_export_failed: ..."]
}
```

`current.map.json` deve includere almeno item per:

```text
module:access
module:subscriptions
module:turnstile
module:audit
file:src/access/access.service.ts
symbol:AccessService
```

Map invarianti:

- ogni item ha `id`, `kind`, `bbox`;
- path relativi POSIX;
- nessun path assoluto;
- comandi sicuri/read-only o memoria;
- `png` nullable.

---

## 8. Demo con modifica simulata

1. Modificare `src/access/access.service.ts` nella fixture.
2. Eseguire:

```bash
pmem refresh --changed-only --json
pmem diff --json
```

Atteso:

- `changedFiles >= 1`;
- `updatedTables` include `files` e `symbols` se il file è stato reindicizzato;
- render aggiorna `current` se `render=true` default;
- `pmem diff` mostra file/simbolo cambiato o warning coerente;
- `current.svg` e `current.map.json` restano validi;
- PNG può restare `null`.

---

## 9. Demo con file cancellato

1. Copiare la fixture in temp dir.
2. Eseguire `pmem init --json && pmem index --json`.
3. Cancellare un file indicizzato, per esempio `src/audit/audit.service.ts`.
4. Eseguire:

```bash
pmem refresh --changed-only --json
pmem query "audit open turnstile" --json
```

Atteso:

- il file cancellato non compare più in `files`/context pack;
- simboli, routes, warnings e test link dipendenti sono rimossi tramite cascade o delete manuale transazionale;
- nessun edge stale punta al file cancellato.

---

## 10. Criteri demo riuscita

La demo è riuscita se:

- tutti i comandi terminano con `ok: true` o warning recuperabili;
- query produce file esatti e pochi;
- duplicate guard sconsiglia nuovo service;
- frame SVG e map JSON sono generati;
- PNG è generato solo se export disponibile, altrimenti `png=null`/warning accettato;
- refresh changed-only non reindicizza tutto;
- diff è compatto e senza codice sorgente;
- nessun output pubblico contiene path assoluti;
- nessun pass richiede embeddings, dashboard, subagenti obbligatori, cloud o modelli esterni.
