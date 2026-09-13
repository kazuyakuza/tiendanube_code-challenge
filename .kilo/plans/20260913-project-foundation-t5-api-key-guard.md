# T5 Implementation Plan — API Key Guard (TODO-02 §5)

> **Target implementer:** JUNIOR developer under 50% restriction. Execute steps
> in order, literally. Do NOT expand scope. If anything is ambiguous or outside
> this plan, STOP and return a question to the caller.
>
> **Source TODO:** `.agent/todos/20260913/20260913-todo-2.md` §5
> (5.1 behaviour, 5.2 approach, 5.3 Swagger).
> **Global plan binding:** G8/G9 (global guard + decorator-exclude, option A),
> G10 (no committed placeholder protected route), G11 (Swagger x-api-key scheme).
> **Branch:** `feat/project-foundation` (already checked out — do NOT create or
> switch branches; that was step 2 of the Critical Workflow).

---

## 0. Resolved Decisions (binding — do not re-litigate)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Header-name constant `API_KEY_HEADER = 'x-api-key'` and Swagger scheme ref constant `API_KEY_SECURITY_SCHEME = 'API-Key'` live in a NEW single file `src/common/api-key.constants.ts`. Both the guard and `main.ts` import from there. No other constant home. | One source of truth; constants file has zero imports ⇒ no import cycles. |
| D2 | Public-metadata key `IS_PUBLIC_KEY = 'isPublic'` is exported from `src/common/decorators/public.decorator.ts` (co-located with the decorator that sets it). The guard imports it from there. No separate constants file for this one. | Single shared const used by decorator + guard; no magic strings. |
| D3 | `@Public()` decorator factory: `export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);` | Matches G9 wording exactly; self-documenting. |
| D4 | `@Public()` is applied at **method level** on `HealthController.ping()` (not the class). | Narrowest scope (prompt's recommendation); single-method controller so behavior is identical, but the pattern scales. |
| D5 | Guard reads metadata with `this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])`. | Verified: `getAllAndOverride` exists in installed `@nestjs/core` `reflector.service.d.ts`; handler-then-class order lets a method-level `@Public()` win and future class-level ones work too. |
| D6 | Guard returns `true` when authorized; otherwise **throws** `new UnauthorizedException(...)` from `@nestjs/common`. It must NEVER `return false`. | Nest converts a guard's `false` into **403 Forbidden**. TODO §5.1 demands **401**. Do not "simplify" this later. |
| D7 | Header value comparison is exact `===` (no crypto/timing-safe comparison — explicitly out of scope per G9 rationale). Provided header is `string \| string[] \| undefined`; a string array (duplicate headers) matches only if its **first** element equals the expected key. Helper `isAuthorizedKey(provided, expected)` keeps `canActivate` single-section. | Single-section boolean conditions rule; max-2-params rule. |
| D8 | Expected key read via `this.configService.getOrThrow<string>(ConfigKeys.ApiKey)`. | Env validation (`env.validation.ts`) guarantees non-empty at bootstrap; `ConfigKeys.ApiKey` already exists in `src/config/config.keys.ts` (verified — member `'API_KEY'`, **no change needed**). |
| D9 | Registration: global `APP_GUARD` provider in `AppModule` (`{ provide: APP_GUARD, useClass: ApiKeyGuard }`). `main.ts` gains no guard-related code. | G8/G9 option A. |
| D10 | Swagger (TODO §5.3): inside `setupSwagger` (existing T3 extension point) extend the builder chain with `.addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, API_KEY_SECURITY_SCHEME)` **and** `.addSecurityRequirements(API_KEY_SECURITY_SCHEME)`. Both methods verified against installed `@nestjs/swagger@11.4.7` `document-builder.d.ts`. The document-level `security` requirement is what makes Swagger UI's **Authorize** button actually send the header on "Try it out" calls (schemes alone are inert). | Trade-off accepted and recorded: the global requirement visually marks the public `HEAD /health/ping` with a padlock in the UI. Cosmetic only — the endpoint itself stays open (guard-exempt). TODO §5.3 asks for a working Authorize button; this is the canonical way. |
| D11 | Verification uses a **temporary** controller file `src/temp-guard-check.controller.ts` (a real `.ts` file so it compiles) temporarily registered in `HealthModule`'s `controllers` array. It is verified, then **deleted**, the module edit reverted, and rebuild + `git status` prove it is gone. It must NEVER be staged or committed. | G10: no committed placeholder protected route; the guard must still be observably tested. The temp controller declares its own `@Controller('temp-guard-check')` (no `VERSION_NEUTRAL`) so it lands under `/v1` and exercises the guard. |
| D12 | One commit: `feat: secure routes with global API key guard and public decorator`. Includes: guard, constants, decorator, health controller edit, `app.module.ts`, `main.ts`, `.agent/project-structure.md`, this plan file. The temp file and the `health.module.ts` temp edit are NEVER staged. | Established per-task feat-commit pattern. |

---

## 1. Prerequisite Checks (read-only)

1. `git status` — expect a clean tree (only untracked user-owned TODO files
   `.agent/todos/20260913/20260913-todo-3.md` / `-todo-4.md` are allowed to
   appear; never stage them).
2. Confirm branch: `git branch --show-current` → `feat/project-foundation`.
3. Confirm `src/config/config.keys.ts` contains `ApiKey: 'API_KEY'` (it does —
   verified 2026-09-13; if somehow absent, STOP and ask the caller).
4. Confirm `src/common/` does not exist yet (it doesn't — you will create it).

---

## 2. Create `src/common/api-key.constants.ts` (NEW file)

Full content:

```ts
/**
 * Shared API-key constants (TODO-02 §5).
 *
 * Single source of truth for the API-key wire format: the HTTP header name
 * (`API_KEY_HEADER`) is used by `ApiKeyGuard` when reading the request and by
 * the Swagger setup in `main.ts` when declaring the security scheme; the
 * scheme reference name (`API_KEY_SECURITY_SCHEME`) ties the Swagger "Authorize"
 * button to that scheme. This file intentionally imports nothing.
 */
export const API_KEY_HEADER = 'x-api-key';

/** OpenAPI security-scheme reference name shown by the Swagger Authorize button. */
export const API_KEY_SECURITY_SCHEME = 'API-Key';
```

## 3. Create `src/common/decorators/public.decorator.ts` (NEW file + NEW folder)

Full content:

```ts
/**
 * Marks a route (method or controller) as public, exempting it from the global
 * `ApiKeyGuard` (TODO-02 §5.2, global plan G8/G9).
 *
 * The guard reads this metadata with
 * `Reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`, so a
 * method-level `@Public()` wins over a class-level one. Currently applied at
 * method level on `HealthController.ping()`.
 */
import { SetMetadata } from '@nestjs/common';

/** Metadata key shared between this decorator and `ApiKeyGuard`. No magic strings. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Exempts the decorated route from the global API-key guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

## 4. Create `src/common/guards/api-key.guard.ts` (NEW file + NEW folder)

Full content — note the depth-2, single-section, ≤2-param helper design:

```ts
/**
 * Global API-key guard (TODO-02 §5).
 *
 * Behavior (§5.1): every request must carry header `x-api-key` whose value
 * matches the validated `API_KEY` env var exactly; anything else is rejected
 * with **401 Unauthorized**. Routes decorated with `@Public()` (handler or
 * class level) are exempt — that is how `HEAD /health/ping` stays reachable.
 *
 * CRITICAL: rejection THROWS `UnauthorizedException` (401). A guard that
 * merely `return false` produces **403 Forbidden** in NestJS — wrong status.
 * Do not "simplify" the throw into a boolean return.
 *
 * Comparison is a plain exact string compare (global plan G9): constant-time
 * comparison and hashing are explicitly out of scope for this challenge.
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigKeys } from '../../config/config.keys';
import { API_KEY_HEADER } from '../api-key.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) {
      return true;
    }
    return this.isRequestAuthorized(context);
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic === true;
  }

  private isRequestAuthorized(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers[API_KEY_HEADER];
    const expectedKey = this.configService.getOrThrow<string>(ConfigKeys.ApiKey);
    if (!isAuthorizedKey(providedKey, expectedKey)) {
      throw new UnauthorizedException('Missing or invalid x-api-key header');
    }
    return true;
  }
}

/**
 * Exact-match policy: `undefined` fails; duplicate headers (array) match only
 * when the FIRST value equals the expected key; otherwise plain `===`.
 */
function isAuthorizedKey(providedKey: string | string[] | undefined, expectedKey: string): boolean {
  if (Array.isArray(providedKey)) {
    return providedKey[0] === expectedKey;
  }
  return providedKey === expectedKey;
}
```

File-rule checks: < 200 lines (≈75), method bodies ≤ 50 lines, no nesting
deeper than 2, helper keeps booleans single-section, no magic strings
(`API_KEY_HEADER`, `IS_PUBLIC_KEY`, `ConfigKeys.ApiKey`).

## 5. Edit `src/health/health.controller.ts` — add `@Public()` + JSDoc reword

Replace the **entire file** with:

```ts
/**
 * Public liveness probe (TODO-02 §4).
 *
 * An unversioned, key-free endpoint answering `200 OK` with an empty body.
 * Unversioned via `VERSION_NEUTRAL` — the installed NestJS 11.2.3 has no
 * `@SkipVersioncheck()` (global plan G8-R).
 *
 * Explicitly exempted from the global `ApiKeyGuard` (TODO-02 §5, T5) via
 * method-level `@Public()` on `ping()`: the guard is registered globally via
 * `APP_GUARD`, so without the decorator this route would demand an API key.
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK`, no API key required (`@Public()`).
   *
   * Call it with curl (`-I` sends a HEAD request and prints the headers):
   *   curl -I http://localhost:3001/health/ping
   */
  @Public()
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void {}
}
```

Changes vs. current file: import line, `@Public()` decorator, and the JSDoc
rewrite — the old claim "until then it is public by default (no guard exists
yet)" is now false and MUST be gone.

## 6. Edit `src/app.module.ts` — register the global guard

Replace the **entire file** with:

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
 * Security (TODO-02 §5): `ApiKeyGuard` is registered globally through the
 * `APP_GUARD` token, so every route requires the `x-api-key` header unless
 * exempted with `@Public()`. Run guide: `docs/app-setup.md`.
 */
import { APP_GUARD, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './common/guards/api-key.guard';
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
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
```

## 7. Edit `src/main.ts` — Swagger security scheme (TODO §5.3)

Exactly three changes; nothing else in the file moves:

**7a.** Add one import (after the `ConfigKeys` import, alphabetical order with
existing relative imports):

```ts
import { API_KEY_HEADER, API_KEY_SECURITY_SCHEME } from './common/api-key.constants';
```

**7b.** Update the JSDoc of `setupSwagger` to replace its last sentence with:

```
 * Builds and mounts the Swagger UI at `/docs` (TODO-02 §3.5) and declares the
 * `x-api-key` security scheme with a document-level security requirement
 * (TODO-02 §5.3, T5): the scheme powers the "Authorize" button, and the
 * requirement makes Swagger UI actually send the header on "Try it out"
 * calls. Cosmetic trade-off: the public health probe also shows the padlock.
```

**7c.** Replace the builder chain inside `setupSwagger` with:

```ts
  const swaggerConfig = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, API_KEY_SECURITY_SCHEME)
    .addSecurityRequirements(API_KEY_SECURITY_SCHEME)
    .build();
```

Signatures verified against installed `@nestjs/swagger@11.4.7`
`dist/document-builder.d.ts`:
`addApiKey(options?: SecuritySchemeObject, name?: string)` and
`addSecurityRequirements(name: string | SecurityRequirementObject, requirements?: string[])`.
Resulting document: `components.securitySchemes['API-Key'] =
{ type: 'apiKey', name: 'x-api-key', in: 'header' }` and top-level
`security: [{ 'API-Key': [] }]`.

`main.ts` stays under 200 lines (~105 after edit).

## 8. Update `.agent/project-structure.md`

In the `# Folders in src/` section, insert this line **before** the
`src/config/` line (alphabetical):

```
- src/common/ - Cross-cutting concerns: API-key constants (api-key.constants.ts), @Public() decorator (decorators/) and global ApiKeyGuard (guards/)
```

## 9. Quality Gates

Run each; all must exit `0`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

(`npm test` / `test:e2e` pass with "No tests found" via `passWithNoTests`.)

If lint flags anything in the new files, fix exactly the flagged lines and
re-run. Do not reformat untouched files.

---

## 10. Runtime Verification with TEMP protected route (G10 protocol)

> The temp controller below is REAL compiled code used only to prove the guard
> rejects/accepts requests. **It must never be staged or committed.** After
> step 10.5 it must not exist on disk.

### 10.1 Create temp file `src/temp-guard-check.controller.ts`

```ts
/**
 * TEMPORARY verification-only controller (T5 plan step 10) — NOT part of the
 * application. Proves the global ApiKeyGuard rejects unauthenticated and
 * wrong-key requests with 401 and accepts the right key with 200.
 * DELETE after verification; never commit.
 */
import { Controller, Get } from '@nestjs/common';

@Controller('temp-guard-check')
export class TempGuardCheckController {
  @Get()
  check(): { ok: boolean } {
    return { ok: true };
  }
}
```

(No `@Public()`, no `VERSION_NEUTRAL` ⇒ lands under `/v1` via URI versioning ⇒
`GET /v1/temp-guard-check`, and the global guard applies.)

### 10.2 Temp-edit `src/health/health.module.ts`

Add to the imports section:

```ts
import { TempGuardCheckController } from '../temp-guard-check.controller';
```

and change the controllers array to:

```ts
  controllers: [HealthController, TempGuardCheckController],
```

### 10.3 Build + run server

```powershell
npm run build
```

Start the server as a background process (use the Kilo background-process
tool, NOT shell backgrounding):

- command: `npm run start:prod` (runs `node dist/main`), workdir repo root,
  readiness port `3001`.

### 10.4 Verification matrix (exact commands, one per PowerShell line)

Read the local key from `.env` into the session (never edit `.env`, never echo
it into a committed file):

```powershell
$key = (Select-String -Path .env -Pattern '^API_KEY=(.*)$').Matches[0].Groups[1].Value
```

Then, each command single-line, record the printed status code:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/v1/temp-guard-check
```
Expected: `401` (missing header → UnauthorizedException, NOT 403).

```powershell
curl.exe -s -o NUL -w "%{http_code}" -H "x-api-key: wrong-key-value" http://localhost:3001/v1/temp-guard-check
```
Expected: `401` (wrong key).

```powershell
curl.exe -s -o NUL -w "%{http_code}" -H "x-api-key: $key" http://localhost:3001/v1/temp-guard-check
```
Expected: `200` (correct key). Note: `-H "x-api-key: $key"` uses double quotes
so PowerShell interpolates `$key`.

Regression — health stays open:

```powershell
curl.exe -s -o NUL -w "%{http_code}" -I http://localhost:3001/health/ping
```
Expected: `200` (no header, `@Public()` works).

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/health/ping
```
Expected: `404` (GET still unsupported — unchanged T4 behavior).

Swagger scheme check:

```powershell
curl.exe -s http://localhost:3001/docs-json | findstr /i "x-api-key"
```
Expected output contains `"name":"x-api-key"` and `"in":"header"`.
Additionally record-only: the document contains
`"security":[{"API-Key":[]}]` (may be minified differently — search for
`API-Key`).

Record-only (no browser needed): in Swagger UI, the **Authorize** button now
lists an `ApiKeyAuth`-style entry named `API-Key` (header `x-api-key`); after
authorizing, "Try it out" sends the header because of the document-level
security requirement (decision D10).

Also observe the server console: morgan logs the 401 lines too (record-only,
already true since T3).

### 10.5 Teardown (mandatory, in order)

1. Stop the background server process.
2. **Delete** `src/temp-guard-check.controller.ts`.
3. **Revert** `src/health/health.module.ts` to exactly:

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

4. Re-run `npm run build` — must exit `0`.
5. Run `git status` — the temp path must be absent (deleted, untracked-never)
   and `health.module.ts` must show **no diff**. `src/common/` files,
   `src/health/health.controller.ts`, `src/app.module.ts`, `src/main.ts` and
   `.agent/project-structure.md` are the only modified/new tracked-source
   entries (plus this plan file under `.kilo/plans/`).

---

## 11. Commit

Stage ONLY these paths (gitignore-compliance: nothing staged may match
`.gitignore`; `.env` is gitignored — never stage it; never stage the temp
controller path — it no longer exists anyway):

```powershell
git add src/common src/health/health.controller.ts src/app.module.ts src/main.ts .agent/project-structure.md .kilo/plans/20260913-project-foundation-t5-api-key-guard.md
git commit -m "feat: secure routes with global API key guard and public decorator"
```

One commit total. No push (git push is restricted to a later workflow step).
No version bump in this step (that is workflow step 3, outside this sub-task).

---

## 12. Out of Scope — HARD

- Transactions modules, business DTOs, any committed tests or e2e specs.
- Rate limiting, key hashing, timing-safe comparison (G9 chose exact compare —
  NO crypto usage).
- New dependencies (all needed packages already installed).
- Branch creation/switch, version bump, `git push` (restricted to other
  workflow steps).
- Edits to `docs/*.md` (that is workflow step 4.4 — see handoff list below).
- User-owned TODO files (`20260913-todo-3.md`, `-todo-4.md`) — never stage.
- Marking the TODO file `[DONE]` (that is workflow step 4.6).

## 13. Documentation Handoff (for workflow step 4.4 — informational only, do
not execute in this sub-task)

The docs step should update `docs/app-setup.md` (and related docs) to reflect:

- Guard behavior: every route requires `x-api-key` matching `API_KEY`; missing
  or wrong key → `401 Unauthorized` (Nest default JSON error body); health
  exempt via `@Public()`.
- `API_KEY` env var moves from "validated but not yet consumed" to
  **consumed** (by `ApiKeyGuard` via `ConfigKeys.ApiKey`).
- Swagger: `/docs` UI now has a working **Authorize** button
  (`API-Key` scheme, header `x-api-key`) and a document-level security
  requirement; padlock on the health probe is cosmetic.
- New curl examples: `curl.exe -s -o NUL -w "%{http_code}" -H "x-api-key: <key> http://localhost:3001/v1/...` for future protected routes (no committed protected route exists — G10).
- Project-structure/architecture notes: `src/common/` now exists.

## 14. Self-Check Against Original Task

- §5.1 exact header match vs env `API_KEY`, 401 on missing/wrong, health open →
  steps 4, 5, 6, 10.4. ✔
- §5.2 `ApiKeyGuard implements CanActivate`, injected `ConfigService`, global
  `APP_GUARD` + decorator-exclude, guard exists and is observably applied via
  TEMP route (deleted after), no committed placeholder → steps 4, 6, 10, D11. ✔
- §5.3 Swagger `x-api-key` scheme so Authorize works → step 7, D10. ✔
- G9 paths `src/common/guards/api-key.guard.ts`, `src/common/decorators/public.decorator.ts`,
  no magic strings, `ConfigKeys.ApiKey`, exact compare, 401 → steps 2–4. ✔
- G10 temp-route protocol with proof of deletion → step 10.5. ✔
