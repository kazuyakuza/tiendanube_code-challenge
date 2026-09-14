# Implementation Plan — TODO-04 Task 3: Module Registration

- **Plan owner**: architector (workflow step 4.1b), for **implementer** (JUNIOR under 50%)
- **TODO scope**: `.agent/todos/20260913/20260913-todo-4.md` §Task 3 ONLY, plus the cross-cutting bullet "reasonable timeout on the Axios instance (3–5 seconds)" and the closing guidance "After this TODO a developer should be able to inject `NumeratorService` and `JsonServerService` into any other service and call them independently."
- **Global plan**: `.kilo/plans/20260913-external-clients.md` — decisions G12, G14, G15, G18, G19 + hard constraints apply.
- **Out of scope (absolute)**: orchestration logic, fee calculation, card masking, controller endpoints, json-server retries, unit/e2e tests, ANY behavior change to `numerator.service.ts` / `json-server.service.ts` (frozen — zero changes, not even comments), `forRoot`-based code, no docker, no push.
- **Front-end**: NO (4.1a/4.5a omitted).
- **Branch discipline**: current branch `feat/external-clients`; NO branch creation (restricted to step 2), NO version bump (step 3), NO push (step 5).

---

## 1. Research evidence (verified, cite-checked)

| Fact | Evidence |
|---|---|
| `@nestjs/axios` v4 exposes `static register(config: HttpModuleOptions): DynamicModule` and has **no** `forRoot` | `node_modules/@nestjs/axios/dist/http.module.d.ts:4` (only `register` + `registerAsync`) |
| `HttpModuleOptions` is `AxiosRequestConfig & {...}` → `{ timeout: number }` typechecks | `node_modules/@nestjs/axios/dist/interfaces/http-module.interface.d.ts:3` |
| `register(config)` creates its OWN axios instance per importing feature module: dynamic providers `AXIOS_INSTANCE_TOKEN → axios.create(config)` + random `HTTP_MODULE_ID` per DynamicModule; base-class decoration exports `HttpService` bound to that module ref | `node_modules/@nestjs/axios/dist/http.module.js:20-35` (instance-per-register) and `:84-95` (default providers/exports) |
| Consequence chosen: BOTH feature modules each import `HttpModule.register(...)` → each gets an **isolated, pre-configured axios instance + HttpService** in its own DI scope. One-time registration in `AppModule` only is REJECTED: it would force sharing one global instance between two unrelated clients (worse isolation, no per-client reuse benefit) and diverges from the global-plan Task-3 wording "both modules import …". |
| `@nestjs/testing` is NOT installed | `node_modules/@nestjs/testing/package.json` glob → no files; `package.json:37-51` devDependencies lack it → temp-script DI check is the REQUIRED mechanism (do NOT install anything — Never-Global + npm rules) |
| Current module files carry "no timeout yet / Task 3 will upgrade" JSDoc to be refreshed | `src/numerator/numerator.module.ts:1-11`, `src/json-server/json-server.module.ts:1-12` |
| `AppModule` currently imports ConfigModule + HealthModule, APP_GUARD provider; tiny file (33 lines) | `src/app.module.ts:22-32` |
| House constants-file JSDoc style (title → TODO/brief refs → AI-agent guidance paragraph) | `src/common/constants/payment-fee.constants.ts:1-12` |
| Structure map already has `src/numerator/`, `src/json-server/`, and `src/common/` mapped | `.agent/project-structure.md:6,10,11` |
| Git baseline: `M package.json` (step-3 bump, pre-existing) + exactly three untracked `?? .agent/todos/20260913/20260913-todo-{4,5,6}.md` | `git status --short` run at planning time |

Config-boot note for the DI sanity check: `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` (app.module.ts:24-28) loads the repo `.env` internally at `NestFactory.create()` time (no external shell env needed), so the services' `getOrThrow` config reads resolve. No service performs HTTP I/O at construction or module init — `HttpService`/axios instances are created lazily and no endpoint calls run → **zero HTTP egress** at listen-less boot.

## 2. Chosen architecture (fixed — implementer does not choose)

**Per-module `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })`** in both feature modules (G12 as adapted per §5 deviation T3-D1), constant in a new shared file, both modules imported into `AppModule` (G14), services already exported (G14 — verify only). Alternative "AppModule registers HttpModule once, global:true" deliberately REJECTED (see §1 consequence row).

---

## 3. Step-by-step implementation (4.2 for implementer)

### Step 3.1 — Create `src/common/constants/http-timeout.constants.ts` (NEW file)

Full content (final, verbatim):

```ts
/**
 * Shared outbound-HTTP Axios timeout (TODO-04 §"Configuration & resilience",
 * global plan G12): a hanging external service must not block a request
 * indefinitely, so every client module's `HttpModule.register({ timeout })`
 * reads this constant — never re-declare the 4000 anywhere.
 *
 * AI-agent guidance: source `.env` URLs stay in validated config only; this
 * file owns the resilience knob. If the timeout value ever needs to become
 * operator-tunable, that is a new decision for the owning TODO, not a local
 * edit.
 */

export const HTTP_TIMEOUT_MS = 4000;
```

Verified: `HttpModuleOptions` (`AxiosRequestConfig^{...}`) accepts `timeout: number`, so the wired form typechecks.

### Step 3.2 — Upgrade `src/numerator/numerator.module.ts` (full final content)

Frozen scope confirmed: the module file's JSDoc is the ONLY text changing besides `imports`; providers/exports untouched.

```ts
/**
 * Feature module for the Numerator client (TODO-04 §1.5, decision T1-D1).
 *
 * Imports `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (TODO-04
 * §"Configuration & resilience", G12): `@nestjs/axios` v4 has NO `forRoot`,
 * and `register` (dist/http.module.js) gives THIS module its own isolated
 * axios instance pre-configured with the 4 s timeout — NumeratorModule's
 * `HttpService` is independent of any other client's instance.
 *
 * Exports `NumeratorService`, and this module is imported in `AppModule`
 * (G14), so the Transactions module (next TODOs) can simply add
 * `NumeratorModule` to its `imports` and inject `NumeratorService`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { NumeratorService } from './numerator.service';

@Module({
  imports: [HttpModule.register({ timeout: HTTP_TIMEOUT_MS })],
  providers: [NumeratorService],
  exports: [NumeratorService],
})
export class NumeratorModule {}
```

### Step 3.3 — Upgrade `src/json-server/json-server.module.ts` (full final content)

```ts
/**
 * Feature module for the json-server client (TODO-04 §2.3, T1-D1 precedent).
 *
 * Imports `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (TODO-04
 * §"Configuration & resilience", G12): `@nestjs/axios` v4 has NO `forRoot`,
 * and `register` (dist/http.module.js) gives THIS module its own isolated
 * axios instance pre-configured with the 4 s timeout — separate from the
 * Numerator client's instance.
 *
 * Exports `JsonServerService`, and this module is imported in `AppModule`
 * (G14), so the Transactions module (next TODOs) can simply add
 * `JsonServerModule` to its `imports` and inject `JsonServerService`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { JsonServerService } from './json-server.service';

@Module({
  imports: [HttpModule.register({ timeout: HTTP_TIMEOUT_MS })],
  providers: [JsonServerService],
  exports: [JsonServerService],
})
export class JsonServerModule {}
```

### Step 3.4 — Wire `src/app.module.ts` (full final content; providers/APP_GUARD untouched)

```ts
/**
 * Root application module.
 *
 * Registers the global, cached ConfigModule with fail-fast environment
 * validation (TODO-02 §2): `ConfigService` can be injected anywhere without
 * re-importing, and startup aborts with a readable error when a required
 * variable is missing or invalid. Imports HealthModule (TODO-02 §4, the
 * public unversioned `HEAD /health/ping` probe, exempted from auth via
 * `@Public()`).
 *
 * External clients (TODO-04 Task 3, G14): `NumeratorModule` and
 * `JsonServerModule` are registered here, making both services injectable
 * anywhere; each carries its own timeout-configured axios instance
 * (`HTTP_TIMEOUT_MS`). There is still NO business route/controller — the
 * clients perform zero outbound HTTP calls until the orchestration TODO
 * (later) wires them to an endpoint.
 *
 * Security (TODO-02 §5): `ApiKeyGuard` is registered globally through the
 * `APP_GUARD` token, so every route requires the `x-api-key` header unless
 * exempted with `@Public()`. Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { NumeratorModule } from './numerator/numerator.module';
import { JsonServerModule } from './json-server/json-server.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }), HealthModule, NumeratorModule, JsonServerModule],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
```

Edits vs. current: two import statements, two array entries, one JSDoc paragraph. Formatting (single-line `ConfigModule.forRoot(...)` vs multi-line) is whatever keeps `npm run lint` (with `--fix`) green — run lint AFTER writing, its fix output governs, then re-run lint to confirm 0 errors (same recheck protocol as Tasks 1–2). File stays ≤ 33-ish lines (≪ 200 limit).

### Step 3.5 — Verification gate (all artifacts temp-only, NEVER staged/committed)

#### 3.5a Build + lint (G16 protocol)

1. `npm run build` → expect exit 0, `dist/` regenerated.
2. `npm run lint` (auto-fixes; `.kilo/rules` PowerShell-single-cmd discipline: run each command alone).
3. Re-run `npm run lint` → expect exit 0 with no remaining fixes (auto-fix recheck).
4. Inspect `git status --short`: `dist/` must NOT appear (gitignored — verify it does not; if it appears, STOP and report).

#### 3.5b Temp DI/boot sanity script (REQUIRED — prove injectability without port binding, without live services, without `.env` mutation)

Because `@nestjs/testing` is absent (§1), write a temporary root-level script **inside the working directory** (no-play rule — root of `C:\repo\tiendanube_code-challenge`), named exactly `tmp-di-sanity.js`:

```js
// TEMPORARY verification artifact — delete after run, never commit.
const { NestFactory } = require('@nestjs/core');
const { NumeratorService } = require('./dist/numerator/numerator.service');
const { JsonServerService } = require('./dist/json-server/json-server.service');

async function run() {
  const { AppModule } = require('./dist/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  const numeratorResolved = app.get(NumeratorService);
  const jsonServerResolved = app.get(JsonServerService);
  if (!(numeratorResolved instanceof NumeratorService)) {
    throw new Error('NumeratorService not resolved from DI container');
  }
  if (!(jsonServerResolved instanceof JsonServerService)) {
    throw new Error('JsonServerService not resolved from DI container');
  }
  console.log('DI-SANITY-OK');
  await app.close();
}

run().catch((error) => {
  console.error('DI-SANITY-FAIL:', error);
  process.exitCode = 1;
});
```

- Mechanics: `npm run build` already produced `dist/app.module.js` + both `dist/**/**.service.js` with real DI metadata (decorators compiled); script boots the REAL AppModule with `logger: false`, `getOrThrow` config keys resolve from the repo `.env` loaded by ConfigModule at create-time, and `app.close()` replaces any `listen` — no port binding, no HTTP egress, no docker, no live services.
- Run: `node tmp-di-sanity.js`
- **Expected console evidence**: exactly one line `DI-SANITY-OK`, exit code 0.
- **On failure** (`create()` or `get()` throws, or `DI-SANITY-FAIL:` printed): treat as FAIL — STOP implementation, report to caller with the error, do NOT commit the registration. Do not improvise fixes beyond plan Steps 3.1–3.4.

#### 3.5c Cleanup assertions

1. Delete `tmp-di-sanity.js` (plain file removal; if some tooling resists, remove via shell after fixing whatever locked it — never commit it).
2. Run `git status --short` → expected EXACTLY: `M package.json` plus the three untracked `?? .agent/todos/20260913/20260913-todo-4.md` / `-todo-5.md` / `-todo-6.md`. Nothing else, no `tmp-*`, no `dist/`, nothing staged.
3. Re-check `git diff --cached` `--name-only` is empty before any commit (gitignore-compliance).

---

## 4. Commit plan (single-cmd PowerShell, exact staged lists)

### Commit 1 (the ONLY code commit)

- Message: `feat(modules): register client modules with axios timeout in HttpModule.register`
- Stage exactly (header-JSDoc updates ride inside these files):
  ```
  src/app.module.ts
  src/common/constants/http-timeout.constants.ts
  src/numerator/numerator.module.ts
  src/json-server/json-server.module.ts
  ```
  → `git add src/app.module.ts src/common/constants/http-timeout.constants.ts src/numerator/numerator.module.ts src/json-server/json-server.module.ts`
- Before committing: `git status --short` confirms no `.gitignore`-matching file staged; `package.json` and the three untracked todo files stay UNSTAGED (G19; step-3 bump ship-in-step-5 ordering — preserve exactly as inherited).
- Pre-commit review: `git diff --cached --stat` shows 4 files, ~30 added lines total.

### Commit 2 (structure map) — DECISION: NONE

- `.agent/project-structure.md:6,10,11` already maps `src/common/`, `src/numerator/`, `src/json-server/`.
- `http-timeout.constants.ts` is a FILE inside the already-mapped `src/common/`; the Project Structure Rule tracks FOLDERS only (`src/common/`'s entry already lists "constants/"). G15 wording "updated in Task 3 commit series" is satisfied by Task-2's already-committed `chore(structure)` + this no-delta outcome.
- **No structure-map change planned; no commit 2.** If the implementer finds a genuinely missing FOLDER in the map at execution time, STOP and ask the caller — do not self-author a map edit.

Net: **1 code commit** for Task 3.

---

## 5. Deviations table (T3-Dx)

| # | Deviation | Justification |
|---|---|---|
| T3-D1 | Global G12 says `HttpModule.forRoot({ timeout: 4000 })`; implementation uses `HttpModule.register({...})` | G12 itself mandates on-disk verification ("verify `forRoot`/`register` availability against installed `@nestjs/axios` v4") — verification (d.ts:4, js:20-35) proves `forRoot` does not exist in v4 and `HttpModuleOptions` typechecks `{ timeout }`. **G12-compliant, not a scope change.** |
| T3-D2 | Global plan's "forRoot wording" row confirms per-module registration here | Per-module `register` gives isolated configured instances per feature module (chosen); one-time-AppModule registration rejected for shared-instance coupling (§1). Matches global-plan Task-3 wording "both modules import (…)". |
| T3-D3 | Injectable-sanity verification is a temp Node script instead of `@nestjs/testing` | `@nestjs/testing` is absent from devDependencies; the script uses the real dist AppModule + real class tokens — stronger evidence; never committed; no new install per project rules. |
| T3-D4 | Single commit instead of separate structure-map commit | Structure map needs zero deltas (§4 Commit 2 decision). |

## 6. Doc/state sweep list — DO NOT write in 4.2; hand explicitly to step 4.4 (docs-specialist)

These texts become STALE the moment Commit 1 lands (they assert "Task 3 not done / not registered / bare HttpModule"):

1. `docs/app-setup.md`:
   - :17 ("neither performs live traffic until Task 3"), :61 (module not registered "until Task 3"), :114–:115 (env table "executes once Task 3 registers the module"), :144–:146 ("only registered in AppModule by Task 3 / no client instance boots today"), :171 (page "Every other route 404s…" — still true), :405–:406 ("Task 3 … is pending"), :415 and :465 (module-table rows "bare HttpModule / not yet imported"), :449–:453 (Task-3 caveat), :522–:525 ("Next: Task 3 … not done"), :628/:636 (resilience/timeout Task-3-open notes).
2. `docs/json-server-client.md`: :7–:8 (wiring banner), :23 (TOC entry), :125-area unaffected, :155–:161 ("Wiring status — Task 3 pointer (not done)" section — rewrite to wired-with-timeout state).
3. `docs/numerator-client` — no separate file exists; Numerator state is documented in `docs/app-setup.md` rows above only. (4.4 may create or leave as-is per its own plan; not a Task-3 edit in 4.2.)
4. `.agent/project-info/architecture.md`: root supers-note + dated entries — :109–:114 ("Still pending (Tasks 2–3)", "HttpModule import is bare"), :142–:149 (Task-2 entry "still pending (Task 3)"), tree lines :173–:174 ("NOT yet imported by app.module.ts, Task 3").
5. `.agent/project-info/context.md`: "current focus / immediate next steps" still describing Modules-await-registration → refresh after commit.
6. Already-fine (self-true post-commit, no edit needed in 4.4 beyond confirmation): `src/config/config.keys.ts` + `env.validation.ts` headers describe consumers, not registration (their "TODO-04 Task 1/2 implemented" wording stays accurate); module-file headers are truthfully refreshed in 4.2; `payment-fee.constants.ts` untouched.

## 7. Acceptance checklist (1:1 with TODO §Task 3 + bindings)

| Acceptance | Evidence |
|---|---|
| Both client modules import `HttpModule` with a timeout | `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` in both module files; `HTTP_TIMEOUT_MS = 4000` constant file exists and compiles (Todo §"Configuration & resilience": 3–5 s). |
| Services exported so other modules can inject | `exports: [NumeratorService] / [JsonServerService]` preserved in both modules (G14). |
| Modules importable later by Transactions module | Module headers enumerate this explicitly; injectability proven by Step 3.5b. |
| Both modules registered in `AppModule` | `AppModule.imports` contains `HealthModule, NumeratorModule, JsonServerModule` (G14); no controller added (out-of-scope guard held). |
| URLs still from ConfigService | Zero `.ts` edits touch services/constants of Tasks 1–2 (frozen); no `process.env` introduced; no URL hardcoding. |
| A developer can inject `NumeratorService` / `JsonServerService` and call them independently after this TODO | `node tmp-di-sanity.js` → `DI-SANITY-OK` (NestFactory boots full container, both classes retrieved, `app.close()` only). |
| Verification | `npm run build` exit 0; `npm run lint` exit 0 twice (fix-recheck); temp script + cleanup assertions passed; `git status` final state exactly `M package.json` + 3 untracked todo files. |
| Commits | Exactly ONE code commit with the 4 files above; no branch/version/push actions in this step. |
| Out-of-scope guards | No orchestration, fee calc, masking controller, json-server retry, or tests touched; no behavior change to either service file (diff of those files vs HEAD must be EMPTY — assert with `git diff --stat -- src/numerator/numerator.service.ts src/json-server/json-server.service.ts` returning nothing). |

## 8. File-size / rule compliance quick-check (before commit)

- `src/app.module.ts` → ~33 lines, ≤ 124-line ideal satisfied; one JSDoc block; nesting depth 1.
- Both module files → ~23–24 lines; import order alphabetical (`@nestjs/axios` → `@nestjs/common` → local) matches house style in existing modules (verify against current file's ordering and keep `common/constants` import between `@nestjs/common` and local relative import as shown).
- No commented-out code anywhere; no new method bodies governed by depth/param rules introduced (this task adds none beyond a constant).
