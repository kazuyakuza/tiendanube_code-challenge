# Implementation Plan — TODO-02 T4: Health Module (`HEAD /health/ping`)

> Source task: `.agent/todos/20260913/20260913-todo-2.md` §4 (Health Module).
> Global plan: `.kilo/plans/20260913-project-foundation.md` (G8 + G8-R corrigendum binding).
> Branch: `feat/project-foundation` (already created in Step 2 — do NOT create/switch branches).
> Plan path: `.kilo/plans/20260913-project-foundation-t4-health.md`
> (name per caller instruction; supersedes the global-plan execution-map shorthand `20260913-pf-t4-health.md`).
> Scope: T4 ONLY. No T5 work.

## 1. Verified Technical Facts (evidence paths)

The following were verified against the installed packages; the implementer must NOT re-litigate them:

| Fact | Evidence |
|---|---|
| `@Head` decorator exists in `@nestjs/common` | `node_modules/@nestjs/common/decorators/http/request-mapping.decorator.d.ts:62` |
| `@Head` maps to HTTP HEAD verb | `node_modules/@nestjs/common/decorators/http/request-mapping.decorator.js:82` → `RequestMethod.HEAD` |
| `@HttpCode(statusCode: number)` exists | `node_modules/@nestjs/common/decorators/http/http-code.decorator.d.ts:11` |
| `VERSION_NEUTRAL` is a `unique symbol` exported from `@nestjs/common` | `node_modules/@nestjs/common/interfaces/version-options.interface.d.ts:7`; re-exported in `node_modules/@nestjs/common/index.d.ts:6` |
| `@Controller(options)` accepts `options.version?: VersionValue` and `VersionValue = string \| typeof VERSION_NEUTRAL \| Array<...>` (symbol accepted) | `node_modules/@nestjs/common/decorators/core/controller.decorator.d.ts:7,25,102` + `version-options.interface.d.ts:11,25` |
| `VERSION_NEUTRAL` under URI versioning yields the path WITHOUT the version prefix (only `/health/ping`, never `/v1/health/ping`) | `node_modules/@nestjs/core/router/route-path-factory.js:19-28` ("Version Neutral - Do not include version in URL") |
| Nest registers the HEAD route on the Express router (method name resolved from `RequestMethod` enum) | `node_modules/@nestjs/core/router/router-explorer.js:99` (`requestMethod: RequestMethod[requestMethod]`) → Express adapter binds `router.head(...)` |
| `@SkipVersioncheck()` does NOT exist in installed NestJS 11.2.3 | Global plan G8-R (verified there by grep over `node_modules/@nestjs/**`) |

Runtime behavior relied upon (confirmed by the verification gates in §6):
- A `void`-returning handler produces an empty response body; for HEAD requests Express/Node never transmit a body regardless.
- Nest's default status for HEAD handlers is already 200; `@HttpCode(HttpStatus.OK)` is kept anyway to make the intent explicit (TODO §4.1 bold requirement).

## 2. Binding Decisions (resolved A–G — no implementer judgment required)

**A — Files**: exactly three code/doc artifacts change:
1. NEW `src/health/health.controller.ts` (full content in §4.1)
2. NEW `src/health/health.module.ts` (full content in §4.2)
3. EDIT `src/app.module.ts` — minimal additive edit; exact final file content in §4.3 (JSDoc line about §4 updated from "later sections ... add" to "implemented", per caller instruction; the §5 wording stays truth).

Plus one meta-doc: `.agent/project-structure.md` gains the `src/health/` line (§4.4).

**B — Handler shape (single choice)**:
```ts
@Head('ping')
@HttpCode(HttpStatus.OK)
ping(): void {}
```
- `void` return ⇒ empty body. This resolves the TODO §4.1 vs §4.2 tension: §4.1 (bold) mandates "200 OK with an empty body"; §4.2's `{ status: 'ok' }` alternative is explicitly conditioned on "if a body is preferred for GET" — no GET route is created, so `void` wins. No GET handler, no body payload, no `@Header()` decorations.
- `HttpStatus.OK` (imported from `@nestjs/common`) instead of the literal `200` — satisfies the "avoid magic numbers" rule.
- Method name: `ping`. Params: none. Body: 1 line. All rules satisfied.
- JSDoc content is fixed in §4.1 — curl idiom is `curl -I <url>` (`-I` makes curl send a HEAD request and print only response headers; it also prevents curl from hanging waiting for a body that never comes — a bare `-X HEAD` without `-I`/`--head` hangs). Do NOT write `-X HEAD` in the JSDoc.

**C — Swagger visibility (single choice)**: health is LEFT VISIBLE in `/docs`.
- Rationale: `SwaggerModule.createDocument` scans all registered routes; a `@Head` route renders as a `head` operation on `/health/ping`. It is a harmless, informative liveness-probe entry; TODO §3.5/§4 never mandate hiding it; adding `@ApiExcludeController()` (which does exist in the installed `@nestjs/swagger`) would be extra, unsolicited scope.
- No Swagger decorators are added in T4. Compile needs none. T5 will later document the security scheme globally.

**D — morgan check**: morgan `dev` format (current `.env` has `NODE_ENV=development`) logs HEAD requests like any method. Expected stdout line pattern after the curl in §6.4: `HEAD /health/ping 200` followed by ms/bytes fields (bytes shown as `-` for empty body). Empty-body strictness is proven by the `size_download=0` check in §6.4, not by the morgan line.

**E — Verification gates** (all must pass, in order): lint → build → test → boot → curl matrix (§6). No orphans left running.

**F — Out-of-scope HARD list** (deviation guard — touching any of these is a scope violation):
- NO `ApiKeyGuard`, NO `@Public()` decorator, NO metadata-key constants, NO `common/` files (T5 owns them).
- NO edits to `src/main.ts` (already versioning-ready; its JSDoc already says health opts out with `VERSION_NEUTRAL`).
- NO GET route on `/health/ping`, NO response body (`{status:'ok'}` forbidden), NO extra endpoints.
- NO tests, NO new dependencies, NO version bump, NO branch creation/switch/push.
- NEVER stage `.agent/todos/20260913/20260913-todo-3.md` or `20260913-todo-4.md` (user-owned, untracked).
- NO edits to `docs/app-setup.md` (documentation belongs to step 4.4 docs-specialist).
- NO refactoring of any existing file beyond the exact `app.module.ts` edit specified in §4.3.

**G — Commit design (single choice)**: ONE commit at the end:
- Message: `feat: add public unversioned health probe endpoint`
- Staged files (exactly five): `src/health/health.controller.ts`, `src/health/health.module.ts`, `src/app.module.ts`, `.agent/project-structure.md`, `.kilo/plans/20260913-project-foundation-t4-health.md`.
- Rationale: plan file + structure doc are part of the workflow artifact set and ride in the same conventional commit.

## 3. Step 0 — Pre-checks

1. Confirm branch: run `git branch --show-current` → expect `feat/project-foundation`. If not, STOP and ask the caller (branch creation is Step-2-restricted).
2. Run `git status` and read `.gitignore`. Note pre-existing untracked files (the two user-owned TODO files must remain untracked/unstaged forever in this task).
3. Confirm prior state: `src/health/` does not exist yet (`Test-Path src/health` → False). If it exists, STOP and ask the caller.

## 4. Code Changes

### 4.1 Create `src/health/health.controller.ts` — EXACT content

```ts
/**
 * Public liveness probe (TODO-02 §4).
 *
 * Exposes `HEAD /health/ping`: an unversioned, key-free endpoint answering
 * `200 OK` with an empty body. Unversioned via `VERSION_NEUTRAL` — the
 * installed NestJS 11.2.3 has no `@SkipVersioncheck()` (global plan G8-R).
 * TODO-02 §5 will exempt this route from the global API-key guard with
 * `@Public()`; until then it is public by default (no guard exists yet).
 *
 * Call it with curl:
 *   curl -I http://localhost:3001/health/ping
 * (`-I` makes curl send a HEAD request and print only the response headers;
 * the response has no body, so nothing else is printed.)
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK` and an empty body.
   */
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void {}
}
```

### 4.2 Create `src/health/health.module.ts` — EXACT content

```ts
/**
 * Feature module for the public liveness probe (TODO-02 §4).
 *
 * Declares `HealthController` (`HEAD /health/ping`). Imports nothing — the
 * global `ConfigModule` (`isGlobal: true`, TODO-02 §2) needs no re-import —
 * and exports nothing, since no other module consumes health.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

### 4.3 Edit `src/app.module.ts` — EXACT final content

Only two deltas vs. current file: (a) the JSDoc paragraph sentence mentioning §4/§5 is reworded so it stays truthful, (b) `HealthModule` import + entry added. Everything else byte-identical.

```ts
/**
 * Root application module.
 *
 * Registers the global, cached ConfigModule with fail-fast environment
 * validation (TODO-02 §2): `ConfigService` can be injected anywhere without
 * re-importing, and startup aborts with a readable error when a required
 * variable is missing or invalid. Also imports HealthModule (TODO-02 §4,
 * the public unversioned `HEAD /health/ping` probe); a later section adds
 * the global API-key guard via `APP_GUARD` (§5). Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

Import-order note: `./config/env.validation` before `./health/health.module` (alphabetical by module path), matching the existing file's convention.

### 4.4 Update `.agent/project-structure.md` — EXACT delta

Insert ONE line between the `src/config/` line and the `test/` line (alphabetical order), keeping every other line untouched:

```text
- src/health/ - Public unversioned liveness probe: HealthModule + HealthController (HEAD /health/ping, TODO-02 §4)
```

## 5. Build & Static Gates (console commands, single commands only)

Run in order from repo root; every one must exit 0:

1. `npm run lint`
2. `npm run build`
3. `npm test`

Expected: all exit 0; `npm test` passes via `passWithNoTests: true` (no suites exist by design in this TODO). If any gate fails, fix ONLY within the T4 files listed in §2-A and re-run all three.

## 6. Runtime Verification

### 6.1 Boot

- Start the app in the background from repo root: `node dist/main` (build already fresh from §5.2).
- Wait for the Nest listen log (contains the port, e.g. `Nest application successfully started` / listen line for 3001). If startup aborts with an env-validation error, STOP and ask the caller (that would mean pre-T4 breakage, not a T4 bug).

### 6.2 curl matrix (PowerShell-safe: always `curl.exe`, never the `curl` alias)

Run each as a single command; record actual outputs:

| # | Command | Expected |
|---|---|---|
| 1 | `curl.exe -I http://localhost:3001/health/ping` | First line `HTTP/1.1 200 OK`; helmet security headers present; NO body lines |
| 2 | `curl.exe -s -I -o NUL -w "%{http_code} %{size_download}" http://localhost:3001/health/ping` | `200 0` (HEAD, empty body proven) |
| 3 | `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/health/ping` | `404` (GET is not routed — HEAD-only endpoint) |
| 4 | `curl.exe -s -I -o NUL -w "%{http_code}" http://localhost:3001/v1/health/ping` | `404` (endpoint is NOT under `/v1` — proves VERSION_NEUTRAL unversioning) |

Record-only (non-blocking, must not fail the task): `curl.exe -s http://localhost:3001/docs-json` contains `/health/ping` with a `head` operation (decision C: health stays visible in Swagger).

### 6.3 morgan check (decision D)

While the app from §6.1 is still running, observe its stdout after command #1 of §6.2: a `dev`-format line matching `HEAD /health/ping 200` must appear (e.g. `HEAD /health/ping 200 1.234 ms - -`). Record it.

### 6.4 Teardown

Stop the background app process. Verify no orphaned `node dist/main` process remains (`Get-Process node` shows none started by this task; use the background-process tool's stop action rather than killing by name).

## 7. Self-Review Checklist (before commit)

- [ ] Only the five files in §2-G were created/modified (`git status --porcelain` confirms; the two user TODO files remain untracked and unstaged).
- [ ] `health.controller.ts` ≤ 200 lines, method bodies ≤ 50 lines, ≤ 2 params, no commented-out code, no literal `200` (uses `HttpStatus.OK`).
- [ ] `health.module.ts` imports nothing beyond `@nestjs/common` + controller; exports nothing.
- [ ] `app.module.ts` matches §4.3 byte-for-byte in structure (JSDoc reworded, `HealthModule` wired).
- [ ] No `@Public`, no guard, no `main.ts` diff (`git diff src/main.ts` is empty), no GET route, no body payload, no tests, no new deps, no `package.json` change.

## 8. Commit (Gitignore Compliance Rule applies)

1. Read `.gitignore` and run `git status`; ensure no ignored files (`.env`, `node_modules/`, `dist/`, `coverage/`, …) are staged. Unstage if any slipped in.
2. Stage exactly: `git add src/health/health.controller.ts src/health/health.module.ts src/app.module.ts .agent/project-structure.md .kilo/plans/20260913-project-foundation-t4-health.md`
3. Commit once: `feat: add public unversioned health probe endpoint`
4. Do NOT push. Do NOT touch branches/remotes.

## 9. Definition of Done

- `src/health/` contains exactly the two files of §4.1/§4.2; `AppModule` imports `HealthModule`; project-structure doc lists `src/health/`.
- Lint/build/test exit 0.
- Live checks: `HEAD /health/ping` → `200`, zero bytes downloaded, no `/v1` variant, GET → 404, morgan logs the HEAD request, app stopped cleanly afterwards.
- One commit `feat: add public unversioned health probe endpoint` with exactly the five files; working tree otherwise untouched.
- Report back: what was done, what was NOT done (T5 items untouched), and the recorded curl/morgan outputs.

## 10. Handoff Notes for Later Steps (informational — NOT implementer scope)

- 4.3 (code-reviewer/simplifier): review only the T4 surface; any simplification beyond cosmetic must go to a new TODO per workflow.
- 4.4 (docs-specialist): `docs/app-setup.md` "API behavior at this stage" section should now list the health endpoint (currently says everything 404s except `/docs`).
- 4.5b (architector): verify against THIS plan + global plan T4 acceptance (`curl -I ... -X HEAD → 200 empty; not under /v1; logged by morgan`).
- T5: add `@Public()` to `HealthController.ping` when the global guard lands (the controller JSDoc already anticipates it).
