# Codex Project Memory Plugin — golden fixtures and expected outputs v0.1

**Stato:** fixture e golden output autoritativi per P3–P9.  
**Scopo:** dare a un agente stupido dati concreti per test, DB rows minime, CLI/MCP expected output e lifecycle fixtures.
**Regola:** se `12_DEMO_SCENARIO.md` diverge da questo file, usare questo file.

---

## 1. Fixture canonica `nest-basic`

Root:

```text
test/fixtures/nest-basic/
```

File obbligatori:

```text
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

### 1.1 `package.json`

```json
{
  "name": "nest-basic-fixture",
  "version": "0.0.0",
  "type": "module",
  "private": true
}
```

### 1.2 `src/subscriptions/subscription.service.ts`

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

### 1.3 `src/access/access.service.ts`

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

### 1.4 `src/access/access.controller.ts`

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

### 1.5 `src/access/access.service.spec.ts`

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

### 1.6 `src/turnstile/turnstile.service.ts`

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

### 1.7 `src/audit/audit.service.ts`

```ts
export class AuditService {
  recordAccessCheck(userId: string, gateId: string, allowed: boolean): void {
    void `${userId}:${gateId}:${allowed}`;
  }
}
```

### 1.8 `src/auth/auth.service.ts`

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

### 1.9 `src/auth/auth.controller.ts`

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

---

## 2. Config fixture esatta

Dopo `pmem init --json`, nei test E2E aggiornare `.codex/memory/project-memory.config.json` con questo contenuto prima di `pmem index`:

```json
{
  "schemaVersion": 1,
  "projectName": "nest-basic-fixture",
  "scan": {
    "include": ["src/**/*"],
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
  "modules": [
    {
      "id": "access",
      "name": "Access",
      "rootPath": "src/access",
      "owns": ["access decision", "allow deny", "gate opening policy"],
      "mustNot": ["duplicate access validation service"],
      "dependencies": ["subscriptions", "audit"],
      "riskLevel": "high"
    },
    {
      "id": "subscriptions",
      "name": "Subscriptions",
      "rootPath": "src/subscriptions",
      "owns": ["subscription status", "subscription lookup"],
      "mustNot": ["turnstile hardware control"],
      "dependencies": [],
      "riskLevel": "normal"
    },
    {
      "id": "turnstile",
      "name": "Turnstile",
      "rootPath": "src/turnstile",
      "owns": ["physical turnstile execution"],
      "mustNot": ["subscription policy"],
      "dependencies": ["access"],
      "riskLevel": "normal"
    },
    {
      "id": "audit",
      "name": "Audit",
      "rootPath": "src/audit",
      "owns": ["audit log", "access check record"],
      "mustNot": [],
      "dependencies": [],
      "riskLevel": "normal"
    },
    {
      "id": "auth",
      "name": "Auth",
      "rootPath": "src/auth",
      "owns": ["current user", "roles"],
      "mustNot": ["subscription status"],
      "dependencies": [],
      "riskLevel": "normal"
    }
  ],
  "criticalRules": [
    "Access decide allow/deny.",
    "Subscription owns status.",
    "Turnstile executes only.",
    "Controller must not contain domain logic.",
    "Every physical open must be audited."
  ],
  "render": {
    "png": true,
    "maxModules": 40,
    "maxWarnings": 20
  },
  "agents": {
    "maxFiles": 8,
    "maxSymbols": 12,
    "maxWarnings": 8
  }
}
```

---

## 3. Expected scan/index rows

### 3.1 Files

After `pmem index --json`, `files` must contain exactly these source rows for the fixture:

| path | language | moduleId | isTest | isGenerated |
|---|---|---|---:|---:|
| `src/access/access.controller.ts` | `typescript` | `access` | false | false |
| `src/access/access.service.spec.ts` | `typescript` | `access` | true | false |
| `src/access/access.service.ts` | `typescript` | `access` | false | false |
| `src/audit/audit.service.ts` | `typescript` | `audit` | false | false |
| `src/auth/auth.controller.ts` | `typescript` | `auth` | false | false |
| `src/auth/auth.service.ts` | `typescript` | `auth` | false | false |
| `src/subscriptions/subscription.service.ts` | `typescript` | `subscriptions` | false | false |
| `src/turnstile/turnstile.service.ts` | `typescript` | `turnstile` | false | false |

Expected counts:

```json
{
  "files.scanned": 8,
  "files.indexed": 8,
  "files.deleted": 0,
  "files.failed": 0
}
```

### 3.2 Modules

`modules` must contain exactly:

```text
access
audit
auth
subscriptions
turnstile
```

Sort by `id asc` for repository/list output:

```text
access, audit, auth, subscriptions, turnstile
```

### 3.3 Symbols minimum set

Constructors are not indexed as symbols. Methods of exported classes are considered exported.

| fqName | kind | filePath |
|---|---|---|
| `AccessController` | `controller` | `src/access/access.controller.ts` |
| `AccessController.open` | `method` | `src/access/access.controller.ts` |
| `AccessDecision` | `interface` | `src/access/access.service.ts` |
| `AccessRequest` | `interface` | `src/access/access.service.ts` |
| `AccessService` | `service` | `src/access/access.service.ts` |
| `AccessService.canOpen` | `method` | `src/access/access.service.ts` |
| `AuditService` | `service` | `src/audit/audit.service.ts` |
| `AuditService.recordAccessCheck` | `method` | `src/audit/audit.service.ts` |
| `AuthController` | `controller` | `src/auth/auth.controller.ts` |
| `AuthController.me` | `method` | `src/auth/auth.controller.ts` |
| `AuthenticatedUser` | `interface` | `src/auth/auth.service.ts` |
| `AuthService` | `service` | `src/auth/auth.service.ts` |
| `AuthService.currentUser` | `method` | `src/auth/auth.service.ts` |
| `SubscriptionService` | `service` | `src/subscriptions/subscription.service.ts` |
| `SubscriptionService.getSubscriptionForUser` | `method` | `src/subscriptions/subscription.service.ts` |
| `SubscriptionService.isSuspended` | `method` | `src/subscriptions/subscription.service.ts` |
| `SubscriptionSnapshot` | `interface` | `src/subscriptions/subscription.service.ts` |
| `SubscriptionStatus` | `type` | `src/subscriptions/subscription.service.ts` |
| `TurnstileService` | `service` | `src/turnstile/turnstile.service.ts` |
| `TurnstileService.open` | `method` | `src/turnstile/turnstile.service.ts` |

Minimum symbol count: `20`. Implementations may add more only if documented in `14`/`16` and golden tests are updated. For v0.1 autonomous implementation, do not add more.

### 3.4 Routes

Routes must contain exactly:

| method | path | handler |
|---|---|---|
| `GET` | `/auth/me` | `AuthController.me` |
| `POST` | `/access/open` | `AccessController.open` |

### 3.5 Test links

At minimum:

| test file | target symbol | testKind |
|---|---|---|
| `src/access/access.service.spec.ts` | `AccessService` | `unit` |

If the implementation can confidently link to `AccessService.canOpen`, it may add that second link only if tests expect stable order. The baseline required link is `AccessService`.

### 3.6 Warnings

External package imports do not create `symbol_edges`. For this fixture, persist these package-import warnings unless config later documents package ignore behavior:

| file | warningType | message contains |
|---|---|---|
| `src/access/access.controller.ts` | `unresolved_import` | `@nestjs/common` |
| `src/auth/auth.controller.ts` | `unresolved_import` | `@nestjs/common` |
| `src/access/access.service.spec.ts` | `unresolved_import` | `vitest` |

No warning is allowed for relative imports in this fixture.

### 3.7 Resolved edges minimum

At minimum, `symbol_edges` should include dependency/import edges equivalent to:

| from | to | edgeKind |
|---|---|---|
| `AccessService` | `SubscriptionService` | `import` |
| `AccessService` | `AuditService` | `import` |
| `AccessController` | `AccessService` | `import` |
| `AccessController` | `AccessRequest` | `import` |
| `TurnstileService` | `AccessService` | `import` |
| `TurnstileService` | `AccessRequest` | `import` |
| `AuthController` | `AuthService` | `import` |

Spec-file imports may add edges to `AccessService`, `SubscriptionService` and `AuditService`; tests should accept them but not require them unless implemented deterministically.

---

## 4. Expected CLI outputs

Golden tests should validate shape, path safety and key content, not volatile timestamps or hashes.

### 4.1 `pmem head --json` before init

```json
{
  "ok": true,
  "data": {
    "status": "not_initialized",
    "memoryRoot": ".codex/memory",
    "schemaVersion": null,
    "lastIndexedAt": null,
    "lastRenderedAt": null,
    "memoryDirty": false,
    "dirtyReason": "",
    "lastError": null,
    "currentFrame": null,
    "activeWarnings": 0
  },
  "warnings": []
}
```

### 4.2 `pmem query` must include

Command:

```bash
pmem query "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento è sospeso." --visual --json
```

Required inclusions:

```text
contextPack.files includes src/access/access.service.ts
contextPack.files includes src/subscriptions/subscription.service.ts
contextPack.files includes src/access/access.service.spec.ts
contextPack.modules includes access
contextPack.modules includes subscriptions
contextPack.constraints includes all 5 criticalRules from fixture config
contextPack.nextCommands contains duplicate check guidance
contextPack.visualFrame.svg == .codex/memory/current.svg if render already ran
```

Required exclusions:

```text
node_modules/**
.codex/memory/**
absolute paths
source code body text
```

Allowed additional files within `maxFiles=8`:

```text
src/turnstile/turnstile.service.ts
src/audit/audit.service.ts
src/access/access.controller.ts
```

### 4.3 `pmem duplicates` canonical command

Use this command in demo/tests:

```bash
pmem duplicates --kind service --module access --name AccessValidationService "AccessValidationService / verifica diritto accesso" --json
```

Expected minimum output:

```json
{
  "ok": true,
  "data": {
    "kind": "service",
    "intent": "AccessValidationService / verifica diritto accesso",
    "risk": "high",
    "verdict": "extend_existing_artifact",
    "matches": [
      {
        "kind": "service",
        "name": "AccessService",
        "fqName": "AccessService",
        "filePath": "src/access/access.service.ts",
        "moduleId": "access",
        "similarity": 0.8,
        "reason": "same module and overlapping access validation responsibility"
      }
    ],
    "recommendation": "Estendere AccessService invece di creare un nuovo servizio di validazione accesso."
  },
  "warnings": []
}
```

Test rule: `similarity` may be any number `>= 0.80`; exact value `0.8` above is lower bound illustration.

### 4.4 `pmem render` expected files

After `pmem render --json`, these files must exist:

```text
.codex/memory/current.svg
.codex/memory/current.map.json
.codex/memory/frames/overview.svg
.codex/memory/frames/overview.map.json
.codex/memory/frames/modules.svg
.codex/memory/frames/modules.map.json
.codex/memory/frames/duplicates.svg
.codex/memory/frames/duplicates.map.json
.codex/memory/frames/risks.svg
.codex/memory/frames/risks.map.json
.codex/memory/generated/project.json
.codex/memory/generated/modules.json
.codex/memory/generated/files.json
.codex/memory/generated/symbols.json
.codex/memory/generated/routes.json
.codex/memory/generated/warnings.json
.codex/memory/generated/edges.json
.codex/memory/generated/duplicates.json
.codex/memory/generated/graph.json
```

PNG files are optional.

### 4.5 `current.map.json` required items

`items[].id` must include at least:

```text
module:access
module:subscriptions
module:turnstile
module:audit
module:auth
file:src/access/access.service.ts
symbol:AccessService
symbol:AccessService.canOpen
route:POST:/access/open
```

Every item must have finite non-negative `bbox`.

---

## 5. Expected MCP sequence

### 5.1 `memory.head` before init

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

### 5.2 `memory.query` after index/render

Input:

```json
{
  "intent": "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento è sospeso.",
  "maxFiles": 8,
  "maxSymbols": 12,
  "maxWarnings": 8,
  "includeVisualFrame": true
}
```

Expected requirements: same inclusions/exclusions as CLI query. Output must not be wrapped in `ok/data`.

### 5.3 `memory.duplicates`

Input:

```json
{
  "kind": "service",
  "intent": "AccessValidationService / verifica diritto accesso",
  "moduleId": "access",
  "proposedName": "AccessValidationService"
}
```

Expected:

```text
risk == high
verdict == extend_existing_artifact
matches[0].name == AccessService
matches[0].moduleId == access
similarity >= 0.80
```

### 5.4 `memory.frame`

Input:

```json
{ "frame": "current" }
```

Expected:

```text
frame == current
svg == .codex/memory/current.svg
map == .codex/memory/current.map.json
png is string or null
warnings may include png_missing only if png == null
```

---

## 6. Refresh and diff golden behavior

### 6.1 Modify file scenario

Modify `src/access/access.service.ts` by adding a new guard branch or method. Then run:

```bash
pmem refresh --changed-only --json
pmem diff --json
```

Expected refresh:

```text
ok == true
changedOnly == true
index.filesIndexed >= 1
render.skipped == false
state.status == fresh
```

Expected diff:

```text
changedFiles includes src/access/access.service.ts
changedModules includes access
addedSymbols may include new method if one was added
no source code body text
```

### 6.2 Delete file scenario

Delete `src/audit/audit.service.ts`, then run:

```bash
pmem refresh --changed-only --json
pmem query "audit open turnstile" --json
```

Expected:

```text
refresh.index.filesDeleted >= 1
files table no longer contains src/audit/audit.service.ts
symbols no longer contain AuditService or AuditService.recordAccessCheck
routes/tests/warnings/edges have no stale reference to deleted file
query output does not include src/audit/audit.service.ts
```

---

## 7. Supported lifecycle fixtures

### 7.1 Skill lifecycle text

`skills/repo-memory/SKILL.md` must contain:

```text
Supported lifecycle
Prompt start: call `memory.agent`
Implementation intent: call `memory.agent`
New artifact intent: call `memory.agent`
After source changes: call `memory.agent`
Review/closeout: call `memory.agent`
```

### 7.2 Agent YAML

`skills/repo-memory/agents/openai.yaml` must contain:

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

### 7.3 Closeout agent

Expected supported closeout after source changes:

```json
{
  "tool": "memory.agent",
  "input": {
    "intent": "post-change refresh",
    "phase": "post_change",
    "allowRefresh": true,
    "render": true
  }
}
```

PNG failure may add `png_export_failed: ...` but must keep the refresh successful if SVG/map succeed.

---

## 8. No absolute path audit

The E2E test must recursively inspect these outputs for absolute paths and backslashes:

```text
CLI JSON stdout for every command
MCP tool outputs
.codex/memory/generated/*.json
.codex/memory/*.map.json
.codex/memory/frames/*.map.json
.codex/memory/snapshots/*.snapshot.json
DB JSON columns: modules.*_json, retrieval_logs.output_json
```

Forbidden patterns:

```text
starts with /
contains :\ on Windows-style drive path
contains \\
contains ../ after normalization
```

---

## 9. Final demo command order

Use this order for P9:

```bash
pmem init --json
pmem doctor --json
pmem scan --json
pmem index --json
pmem render --json
pmem head --json
pmem query "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento è sospeso." --visual --json
pmem duplicates --kind service --module access --name AccessValidationService "AccessValidationService / verifica diritto accesso" --json
pmem frame current --json
pmem refresh --changed-only --json
pmem diff --json
```

The older command without `--module access --name AccessValidationService` is allowed only as a loose manual demo, not as a golden test.
