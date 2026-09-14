# Implementation Plan — TODO-06 Cycle B: Error Handling & Compensation (§Task 2)

- Source: `.agent/todos/20260913/20260913-todo-6.md` §Task 2 (sub-sections §2.1, §2.2, §2.3)
- Binding global plan: `.kilo/plans/20260914-transactions-endpoint.md` — **G4** (filter location + mapping), **G5** (compensation), **G7** (frozen surfaces), **G8** (structure rules), **G9** (verification gates)
- Cycle A already landed: controller `d12676f`, docs `9ed4ca7`, `[DONE]` on §Task 1/§Task 3. Branch `feat/transactions-endpoint`, v0.5.0 — **branch/version/push operations are OUT OF SCOPE here**.
- Implementer profile: JUNIOR, 50% restriction — every structural decision is encoded below as CB-D1…CB-D8; do not deviate, do not "improve" other files.

## 0. Verified current state (researched, 2026-09-14)

| File | State relevant to Cycle B |
|------|---------------------------|
| `src/transactions/transactions.service.ts` | 124 lines. `create()` has **zero try/catch**; `createReceivable` call at lines 76–78; in-file interfaces precedent (`ReservedIds`, payload-context objects). |
| `src/transactions/transactions.controller.ts` | 78 lines, thin G3 handler, no try/catch. Swagger descriptions on lines 70–72 + JSDoc §"Error behaviour" (lines 21–26) say the mapping "lands with the Cycle-B exception filter" — becomes FALSE after this cycle. |
| `src/transactions/transactions.module.ts` | 32 lines; imports `NumeratorModule, JsonServerModule`; provides+exports service; registers controller. |
| `src/app.module.ts` | 49 lines; `APP_GUARD` provider present (imported from **`@nestjs/core`** — same module exports `APP_FILTER`). No filter yet. |
| `src/common/filters/` | **Does NOT exist** — directory must be created by this cycle. |
| `src/numerator/errors/numerator.errors.ts` | `NumeratorUnavailableError`, `NumeratorRetriesExhaustedError` (message: "Numerator ID reservation failed after N attempts (last known current: X)"), `InvalidNumeratorValueError` — plain `Error` subclasses, payload-safe messages. |
| `src/json-server/errors/json-server.errors.ts` | `JsonServerRequestError` with `resource: string`, `status: number | undefined`; message built only from resource + status + axios reason (T2-D7 privacy). |
| `src/json-server/json-server.constants.ts` | Exports `TRANSACTIONS_RESOURCE_PATH = 'transactions'` — **import-only reuse allowed** (G7 forbids diffs to that folder, not imports of it). |
| `src/common/constants/http-timeout.constants.ts` | 13-line single-constant file — the naming/header pattern to mirror. |
| `src/config/config.keys.ts` + `env.validation.ts` | `ConfigKeys.NodeEnv`, `NodeEnvironment` enum (`development/production/test`) exist. **No new env keys are added by Cycle B** (G7). |
| `src/numerator/numerator.service.ts` | Private `sleep(ms)` inline method + backoff `min(base × 2^idx, cap)` — the retry-loop precedent to mirror. |
| `package.json` | `supertest` present in devDeps; jest `passWithNoTests: true`; **no spec files are created by this cycle** (tests = TODO-07). |
| docker-compose | `json-server` (:8080), `numerator-api` (:3000) — agents NEVER run docker (G9). |

---

## 1. Binding decisions (CB-D1…CB-D8) — no implementer judgment required

### CB-D1 — Filter layout: ONE class, catch-all, tiny private helpers

Single class `AllExceptionsFilter` in `src/common/filters/all-exceptions.filter.ts`:

- `@Catch()` with **no argument list** (catch-all). Rationale: Nest guarantees a single global filter receives everything; a two-class split (HttpException formatter + domain mapper) would need a second APP_FILTER registration and ordering guarantees — more moving parts for zero benefit at this size, and G8's max-depth/max-lines rules are satisfied by private helper methods, not by more classes.
- Dispatch inside `catch()` (3 branches, each 1 call deep — max depth 2):
  1. `exception instanceof HttpException` → `toHttpExceptionBody()` → re-emit with the exception's own status (preserves guard-401 / ValidationPipe-400 / router-404 shapes verbatim — global-plan risk R2).
  2. domain error → `resolveDomainBody()` → mapped 503/502 body.
  3. anything else → `Logger.error` (stack, server-side, ALWAYS) → generic 500 body.
- Registration via `{ provide: APP_FILTER, useClass: AllExceptionsFilter }` in `app.module.ts` (mirrors the existing `APP_GUARD` pattern; **`APP_FILTER` is exported by `@nestjs/core`**, same as `APP_GUARD` — T5 precedent where the plan originally mis-imported it from `@nestjs/common`).

### CB-D2 — Response body shape and message sourcing

Body shape everywhere: `{ statusCode, message, error }` (§2.3).

- `error` = HTTP reason phrase from a **local constant map** in the filter file (`HTTP_STATUS_PHRASES`). NO new dependency (`http-status` package is forbidden — zero new npm deps this cycle).
- **HttpException pass-through (CB-D2a):** if `exception.getResponse()` returns an object → emit it **as-is** (Nest built-ins already carry the `{ statusCode, message, error }` shape; the ValidationPipe `message` is a `string[]` and MUST survive unmodified). If it returns a string → wrap as `{ statusCode, message: <string>, error: HTTP_STATUS_PHRASES[status] }`.
- **Domain errors (CB-D2b):** `message` = **`err.message` verbatim, no suffix, no rewriting**. Rationale (junior-proof): every domain error message is already payload-safe by construction (T2-D7/G8: `JsonServerRequestError` message = resource + status + axios reason; Numerator messages = attempt counts / raw values — never card data) and already contains the §2.1-required detail ("Numerator ID reservation failed after 10 attempts…", "json-server request failed — resource=…, status=…"). Copying fixed strings would LOSE the detail the TODO asks to include. Never log or serialize payloads anywhere in the filter.

Exact §2.1 → status mapping (encoded; matches G4):

| Thrown error | Status | `message` | `error` |
|---|---|---|---|
| `NumeratorUnavailableError` | 503 | `err.message` | `Service Unavailable` |
| `NumeratorRetriesExhaustedError` | 503 | `err.message` | `Service Unavailable` |
| `InvalidNumeratorValueError` | 503 | `err.message` | `Service Unavailable` |
| `JsonServerRequestError`, `status === undefined` OR `status >= 500` | 503 | `err.message` | `Service Unavailable` |
| `JsonServerRequestError`, `status` in 400–499 | 502 | `err.message` | `Bad Gateway` |
| `JsonServerRequestError`, any other numeric status (<400 — unreachable in practice) | 502 | `err.message` | `Bad Gateway` (upstream-anomaly defensive default) |
| ValidationPipe 400 / guard 401 / router 404 / any `HttpException` | its own status | passthrough shape (CB-D2a) | passthrough |
| unknown error | 500 | `Internal server error` | `Internal Server Error` |

### CB-D3 — Production stack rule: LOG-ONLY approach, NO ConfigService in the filter

The filter has a **zero-dependency constructor** (no injected `ConfigService`, no `NODE_ENV` read):

- Unknown errors: full detail (`error.message` + `error.stack`) goes to `Logger.error` **server-side in every environment**.
- The client body for unknown errors is **ALWAYS the generic 500 body** (`Internal server error` / `Internal Server Error`) in every environment.
- Consequence: no stack or internal detail can ever reach a client, so the §2.3 "no leak when `NODE_ENV=production`" requirement is satisfied **by construction** — stronger than the minimum and immune to a forgotten env read. Rationale for rejecting the ConfigService variant: it adds DI, a second body variant and an env branch for zero client-visible benefit; domain-error messages remain payload-safe per CB-D2b.

### CB-D4 — Compensation class: placement, retry loop, constants, contract

- **File:** `src/transactions/transaction-compensation.service.ts` (FLAT next to the other transactions files — mirrors the feature-folder flat-file pattern: `fee-rules.ts`, `transactions.service.ts`; the `compensation/` subfolder option from G5 is rejected because the module has exactly one new class).
- **Class:** `TransactionCompensationService`, `@Injectable()`, provided in `TransactionsModule` (NOT exported — private member rule; nothing else consumes it).
- **Constructor (exactly 2 params):** `HttpService` + `ConfigService`. Base URL = `configService.getOrThrow<string>(ConfigKeys.JsonServerUrl)` with the same trailing-slash normalization as `JsonServerService` (`.replace(/\/+$/, '')`).
- **Method:** `deleteTransaction(transactionId: string): Promise<boolean>` — `true` = transaction deleted (or already absent), `false` = still orphaned after all attempts.
- **Retry loop:** up to `COMPENSATION_MAX_ATTEMPTS` **total attempts**; backoff sleep BETWEEN attempts only (`min(base × 2^(attempt−1), cap)`; no sleep after the final failure) — identical shape to `NumeratorService`'s loop.
- **Idempotency (CB-D4a):** a `404` response on the DELETE counts as SUCCESS (`true`) — the row is already gone; retrying a permanent 404 would waste the budget. Detection: `isAxiosError(error) && error.response?.status === 404` (import `isAxiosError` from `axios`, same as the clients).
- **Sleep helper:** inline `private sleep(ms: number)` in the class (NumeratorService precedent — NO separate util file).
- **Contract: `deleteTransaction` NEVER THROWS.** Every failure path is caught internally and logged (warn per attempt; error on exhaustion). This is what lets `TransactionsService` call it without a defensive second try/catch (see CB-D6) and guarantees the original receivable error is never masked (G5/R3).
- **Constants file (NEW):** `src/common/constants/compensation.constants.ts`, mirroring the `http-timeout.constants.ts` pattern:
  - `COMPENSATION_MAX_ATTEMPTS = 3`
  - `COMPENSATION_BASE_BACKOFF_MS = 200`
  - `COMPENSATION_MAX_BACKOFF_MS = 1600`
- **NO new env keys** (G7): the knobs are in-code constants only; `JSON_SERVER_URL` reuse needs no config change.
- **DELETE URL:** `` `${this.baseUrl}/${TRANSACTIONS_RESOURCE_PATH}/${transactionId}` `` — imports `TRANSACTIONS_RESOURCE_PATH` from `../../json-server/json-server.constants` (import-only reuse; zero diffs under `src/json-server/`).
- **Logging privacy:** transaction ids, attempt counters and axios-generated reasons ONLY — never payloads, never upstream bodies (T2-D7/G5).

### CB-D5 — TransactionsModule wiring

`TransactionsModule` imports its own **`HttpModule.register({ timeout: HTTP_TIMEOUT_MS })`** (isolated-instance precedent T3-D2; `JsonServerModule` does not export `HttpService`) and adds the compensation service to `providers`. Controllers list unchanged.

### CB-D6 — TransactionsService diff: catch ANY receivable-write failure, rethrow ORIGINAL

- The **ONLY** try/catch (G5) wraps **ONLY the `createReceivable` call** inside `create()`.
- **Catch scope = ANY error**, not just `JsonServerRequestError`: at that point the transaction row already exists, so ANY receivable failure (transport 5xx, network, or anything unexpected) leaves an orphan and compensation is safe. Numerator failures happen **before any write** and stay OUTSIDE the try — no compensation attempted, no orphan possible (zero-orphan reservation order).
- On catch: `await this.compensateOrphanedTransaction(ids.transactionId, error)` (bounded: ≤3 attempts + ≤1.6 s cap) then `throw error` — **the ORIGINAL receivable error**, so the filter's G4 mapping is unchanged by compensation. Compensation never throws (CB-D4 contract), so the rethrow is always of the original error.
- New private helper `compensateOrphanedTransaction(transactionId: string, receivableError: unknown): Promise<void>` (2 params ✓): calls `deleteTransaction`, and when it returns `false` logs ONE `logger.error` line: orphaned transaction id + the receivable failure reason (ids + reason only — G5 privacy). Success of compensation needs no extra service-level log (the compensation service already logs its own success warn); the client STILL receives the original error either way.
- No second try/catch anywhere in the service (the compensation class guarantees non-throwing).

### CB-D7 — Controller Swagger truth fix lands in 4.2 (commit 3)

Cycle A's Swagger `description` strings + controller JSDoc say the 502/503 mapping "lands with the Cycle-B exception filter" — after this cycle that is FALSE. The fix is a **code-adjacent metadata edit** and ships WITH the implementation (not deferred to 4.4): remove the "(mapping lands with the Cycle-B exception filter)" suffixes from the three `@Api…Response` descriptions and rewrite the JSDoc "Error behaviour" paragraph to state the filter is LIVE. Exact diffs in Step 4. Exact strings are given — no judgment.

### CB-D8 — Verification strategy: gates + ONE temp script (`tmp-error-sanity.js`), NO supertest

- Gates per G9: `npm run build`, `npm run lint`, `npm test` all exit 0 (lint is run twice: once after code, once at the end — `--fix` can mutate files, so a second pass must also be clean).
- Runtime proof: a **temporary root script** `tmp-error-sanity.js` (CommonJS, requires `./dist` after build — T3-D3/CA-D5 precedent; `@nestjs/testing` is not installed):
  1. `NestFactory.create(AppModule)` (in-process; `.env` provides PORT/URLs; NO outbound calls are made — no route is invoked).
  2. Build the filter directly: `new AllExceptionsFilter()` (zero-dependency constructor per CB-D3 — no DI resolution risk).
  3. Invoke `filter.catch(exception, fakeHost)` where `fakeHost.switchToHttp()` returns `{ getResponse: () => recordingResponse }` and `recordingResponse` captures `status()`/`json()` calls.
  4. Assert (hard `!==`/`===` checks + `process.exit(1)` on mismatch):
     - `new NumeratorRetriesExhaustedError(10, 3)` → 503, body.message contains "after 10 attempts", `error === 'Service Unavailable'`
     - `new JsonServerRequestError({ resource: 'receivables', status: 400, reason: 'Request failed with status code 400' })` → 502, `error === 'Bad Gateway'`
     - `new JsonServerRequestError({ resource: 'transactions', status: undefined, reason: 'timeout of 4000ms exceeded' })` → 503
     - `new JsonServerRequestError({ resource: 'transactions', status: 502, reason: '…' })` → 503
     - `new Error('boom')` → 500, body deep-equals `{ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }`
     - `new UnauthorizedException('Missing or invalid x-api-key header')` → 401, body deep-equals the exact Nest guard shape
     - a ValidationPipe-shaped body: `new BadRequestException(['value must be…', 'cardCvv must be…'])` → 400, `message` is still the ARRAY (pass-through regression check for R2)
     - `new NotFoundException('Cannot GET /nope')` → 404 passthrough
  5. Print `ERROR-SANITY-OK`, `app.close()`, exit 0.
  - This is judged **sufficient**; a supertest HTTP boot is NOT added (the filter is exercised by the exact same code path for guard/pipe exceptions — they are `HttpException`s — and the script avoids port binding + env juggling). The 201 happy path needs no proof (Cycle A, untouched).
- The temp script is NEVER committed; it is deleted in the same step that runs it.

---

## 2. Files: NEW / EDITED / FROZEN

**NEW (3):**
1. `src/common/filters/all-exceptions.filter.ts`
2. `src/transactions/transaction-compensation.service.ts`
3. `src/common/constants/compensation.constants.ts`

**EDITED (4):**
4. `src/transactions/transactions.service.ts` (G5-authorized try/catch + compensation call-site ONLY)
5. `src/transactions/transactions.module.ts` (HttpModule import + provider)
6. `src/app.module.ts` (APP_FILTER provider + header sentence)
7. `src/transactions/transactions.controller.ts` (comment/Swagger-description truth fix ONLY — CB-D7)

**FROZEN (zero diffs — G7):** `src/numerator/**`, `src/json-server/**`, all DTOs/enums/validators, `src/config/config.keys.ts`, `src/config/env.validation.ts`, all existing `src/common/constants/*`, `src/main.ts`, `package.json` (no deps), `.env.example`, `docker-compose.yml`. `.agent/project-structure.md` + `architecture.md` + `docs/*` updates belong to step **4.4 (docs-specialist)**, NOT to this implementation plan (folder `src/common/filters/` + transactions compensation lines are documented there).

---

## 3. Step 1 — New filter file (commit 1)

Create `src/common/filters/all-exceptions.filter.ts` with EXACTLY this content (≈115 lines total, ≈75 effective — G8 ✓):

```typescript
/**
 * Global exception filter (TODO-06 §Task 2.3, global plan G4; cycle B).
 *
 * The single error-mapping surface of the API (G3/G4): every unhandled
 * exception reaches `catch()` and is answered with the structured
 * `{ statusCode, message, error }` JSON body.
 *
 * Dispatch (max depth 2):
 * 1. `HttpException` → re-emitted with its own status and its own response
 *    object (guard 401, ValidationPipe 400 — whose `message` is a string[]
 *    that MUST survive untouched — router 404, any future HttpException).
 * 2. Domain errors from the external clients → §2.1 mapping:
 *    Numerator errors → 503; `JsonServerRequestError` → 503 when the status
 *    is unknown or >= 500, 502 (Bad Gateway) on 4xx. Messages pass through
 *    VERBATIM: they are payload-safe by construction (T2-D7/G8) and already
 *    carry the required detail (e.g. "Numerator ID reservation failed after
 *    N attempts", "json-server request failed — resource=…, status=…").
 * 3. Unknown errors → logged server-side with stack (Logger.error, ALWAYS)
 *    and answered with the generic 500 body in EVERY environment — no stack
 *    or internal detail can ever reach a client, which satisfies the
 *    §2.3 production no-leak rule by construction (decision CB-D3).
 *
 * AI-agent guidance: NO ConfigService/NODE_ENV read here (CB-D3, log-only
 * approach); never log request payloads (card data — TODO privacy rule);
 * mapping domain errors is THIS filter's job — clients never throw HTTP
 * statuses (global plan G18). Registered via APP_FILTER in app.module.ts
 * (the token comes from @nestjs/core, same as APP_GUARD).
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JsonServerRequestError } from '../../json-server/errors/json-server.errors';
import {
  InvalidNumeratorValueError,
  NumeratorRetriesExhaustedError,
  NumeratorUnavailableError,
} from '../../numerator/errors/numerator.errors';

/** HTTP reason phrases for every status this filter can emit. */
const HTTP_STATUS_PHRASES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

/** Structured error body of §2.3. */
interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
}

/** Generic 500 body sent for unknown errors in every environment (CB-D3). */
const INTERNAL_ERROR_BODY: ErrorResponseBody = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'Internal server error',
  error: 'Internal Server Error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(this.toHttpExceptionBody(exception));
      return;
    }
    const domainBody = this.resolveDomainBody(exception);
    if (domainBody !== undefined) {
      response.status(domainBody.statusCode).json(domainBody);
      return;
    }
    this.logUnknown(exception);
    response.status(INTERNAL_ERROR_BODY.statusCode).json(INTERNAL_ERROR_BODY);
  }

  private toHttpExceptionBody(exception: HttpException): object {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return {
        statusCode: exception.getStatus(),
        message: payload,
        error: HTTP_STATUS_PHRASES[exception.getStatus()],
      };
    }
    return payload;
  }

  private resolveDomainBody(exception: unknown): ErrorResponseBody | undefined {
    if (
      exception instanceof NumeratorUnavailableError ||
      exception instanceof NumeratorRetriesExhaustedError ||
      exception instanceof InvalidNumeratorValueError
    ) {
      return this.buildBody(HttpStatus.SERVICE_UNAVAILABLE, exception.message);
    }
    if (exception instanceof JsonServerRequestError) {
      return this.buildBody(this.mapJsonServerStatus(exception.status), exception.message);
    }
    return undefined;
  }

  private mapJsonServerStatus(status: number | undefined): number {
    if (status === undefined || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.BAD_GATEWAY;
  }

  private buildBody(statusCode: number, message: string): ErrorResponseBody {
    return { statusCode, message, error: HTTP_STATUS_PHRASES[statusCode] };
  }

  private logUnknown(exception: unknown): void {
    const detail = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`Unhandled exception: ${detail}`);
  }
}
```

Implementation notes for the junior implementer:
- `HTTP_STATUS_PHRASES` uses computed keys — that is valid TS/ES2021; do not expand to a switch.
- `toHttpExceptionBody` returns `object` on purpose: the ValidationPipe payload's `message` is a `string[]`, and re-typing it would risk mangling the pass-through. The response `json()` accepts it as-is.
- The `error` phrase for a wrapped string HttpException may be `undefined` for exotic statuses — acceptable: those only occur for statuses Nest itself emits, all present in the map.

## 4. Step 2 — Wire APP_FILTER in app.module.ts (commit 1)

Edit `src/app.module.ts` — three exact changes:

**4.1 Import (after line 26 `import { APP_GUARD } from '@nestjs/core';`):**

```typescript
// BEFORE
import { APP_GUARD } from '@nestjs/core';
// AFTER
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
```

**4.2 New import (add after the `ApiKeyGuard` import line):**

```typescript
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
```

**4.3 Providers array:**

```typescript
// BEFORE
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
// AFTER
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
```

**4.4 Header JSDoc — append one sentence to the "Security (TODO-02 §5)" paragraph:**

```text
Error handling (TODO-06 Cycle B): `AllExceptionsFilter` is registered
globally through the `APP_FILTER` token and answers every unhandled
exception with the structured `{ statusCode, message, error }` body
(§2.1 mapping: Numerator → 503; json-server unknown/5xx → 503, 4xx → 502;
unknown → generic 500).
```

## 5. Step 3 — Compensation constants + class + module + service diff (commit 2)

### 5.1 NEW `src/common/constants/compensation.constants.ts` (≈20 lines)

```typescript
/**
 * Partial-failure compensation tuning constants (TODO-06 §Task 2.2, global
 * plan G5; cycle B): retry budget and backoff for
 * `TransactionCompensationService.deleteTransaction`, the DELETE that removes
 * a transaction orphaned by a failed receivable write.
 *
 * AI-agent guidance: NO env keys back these values (G7 — in-code constants
 * only, mirroring `http-timeout.constants.ts`); the goal is to REDUCE
 * orphans, not eliminate them (TODO §2.2) — do not raise the budget into a
 * saga. Never re-declare these numbers elsewhere.
 */

/** Total DELETE attempts per compensation call (no sleep after the last). */
export const COMPENSATION_MAX_ATTEMPTS = 3;

/** Base backoff in ms before the 2nd attempt: min(base × 2^(attempt−1), cap). */
export const COMPENSATION_BASE_BACKOFF_MS = 200;

/** Upper bound of the compensation backoff curve, in ms. */
export const COMPENSATION_MAX_BACKOFF_MS = 1600;
```

### 5.2 NEW `src/transactions/transaction-compensation.service.ts` (≈120 lines, ≈80 effective)

```typescript
/**
 * Partial-failure compensation service (TODO-06 §Task 2.2, global plan G5;
 * cycle B).
 *
 * When `TransactionsService.create()` persisted the transaction but the
 * receivable write failed, this class tries to delete the orphaned
 * transaction (`DELETE {JSON_SERVER_URL}/transactions/:id`) with a bounded
 * retry loop — up to `COMPENSATION_MAX_ATTEMPTS` total attempts, sleeping
 * `min(COMPENSATION_BASE_BACKOFF_MS × 2^(attempt−1), COMPENSATION_MAX_BACKOFF_MS)`
 * between them (never after the last). A 404 counts as success (CB-D4a):
 * the row is already gone, so a permanent 404 must not waste the budget.
 *
 * CONTRACT (decision CB-D4/CB-D6): `deleteTransaction` NEVER THROWS. Every
 * failure is caught here and logged; it returns `true` (deleted or already
 * absent) or `false` (still orphaned). This is what lets the orchestration
 * service rethrow the ORIGINAL receivable error without a defensive second
 * try/catch, and guarantees compensation can never mask it (G5/R3).
 *
 * Privacy: logs carry the transaction id, attempt counters and
 * axios-generated reasons ONLY — never payloads, never upstream bodies
 * (T2-D7/G5). The goal is to REDUCE orphans, not eliminate them (§2.2); if
 * all attempts fail the inconsistency is logged and the caller still errors
 * the client. This is a NEW consumer of json-server — `src/json-server/`
 * itself gets ZERO diffs (G7); the resource path is imported from its
 * constants. HttpModule registration lives in TransactionsModule (isolated
 * instance, T3-D2 precedent).
 */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  COMPENSATION_BASE_BACKOFF_MS,
  COMPENSATION_MAX_ATTEMPTS,
  COMPENSATION_MAX_BACKOFF_MS,
} from '../common/constants/compensation.constants';
import { ConfigKeys } from '../config/config.keys';
import { TRANSACTIONS_RESOURCE_PATH } from '../json-server/json-server.constants';

/** Param object for a failed DELETE attempt (2-params rule). */
interface CompensationFailureContext {
  transactionId: string;
  attempt: number;
  error: unknown;
}

@Injectable()
export class TransactionCompensationService {
  private readonly logger = new Logger(TransactionCompensationService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.normalizeBaseUrl(
      configService.getOrThrow<string>(ConfigKeys.JsonServerUrl),
    );
  }

  async deleteTransaction(transactionId: string): Promise<boolean> {
    this.logger.warn(`compensation started — deleting orphaned transaction ${transactionId}`);
    for (let attempt = 1; attempt <= COMPENSATION_MAX_ATTEMPTS; attempt++) {
      if (await this.tryDelete(transactionId, attempt)) {
        return true;
      }
    }
    return false;
  }

  private async tryDelete(transactionId: string, attempt: number): Promise<boolean> {
    const resourceUrl = `${this.baseUrl}/${TRANSACTIONS_RESOURCE_PATH}/${transactionId}`;
    try {
      await firstValueFrom(this.httpService.delete(resourceUrl));
      this.logger.warn(
        `compensation succeeded — transaction ${transactionId} deleted (attempt ${attempt})`,
      );
      return true;
    } catch (error) {
      return this.handleDeleteFailure({ transactionId, attempt, error });
    }
  }

  private async handleDeleteFailure(context: CompensationFailureContext): Promise<boolean> {
    const reason = describeError(context.error);
    if (this.isAlreadyAbsent(context.error)) {
      this.logger.warn(
        `compensation succeeded — transaction ${context.transactionId} already absent (attempt ${context.attempt})`,
      );
      return true;
    }
    this.logger.warn(
      `compensation delete failed — transaction ${context.transactionId}, attempt ${context.attempt}/${COMPENSATION_MAX_ATTEMPTS}, reason=${reason}`,
    );
    if (context.attempt >= COMPENSATION_MAX_ATTEMPTS) {
      this.logger.error(
        `compensation exhausted — transaction ${context.transactionId} may remain orphaned, last reason=${reason}`,
      );
      return false;
    }
    await this.sleep(this.computeBackoffDelay(context.attempt));
    return false;
  }

  private isAlreadyAbsent(error: unknown): boolean {
    return isAxiosError(error) && error.response?.status === HttpStatus.NOT_FOUND;
  }

  private normalizeBaseUrl(rawBaseUrl: string): string {
    return rawBaseUrl.replace(/\/+$/, '');
  }

  private computeBackoffDelay(attempt: number): number {
    const retryIndex = attempt - 1;
    return Math.min(
      COMPENSATION_BASE_BACKOFF_MS * 2 ** retryIndex,
      COMPENSATION_MAX_BACKOFF_MS,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

Implementation note: add `HttpStatus` to the `@nestjs/common` import line in this file (`import { HttpStatus, Injectable, Logger } from '@nestjs/common';`) — the snippet above lists `Injectable, Logger` separately for readability; the final import must be a single line and eslint-clean.

### 5.3 EDIT `src/transactions/transactions.module.ts`

```typescript
// BEFORE (imports block of the @Module decorator + file imports)
import { Module } from '@nestjs/common';
import { JsonServerModule } from '../json-server/json-server.module';
import { NumeratorModule } from '../numerator/numerator.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [NumeratorModule, JsonServerModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
// AFTER
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { JsonServerModule } from '../json-server/json-server.module';
import { NumeratorModule } from '../numerator/numerator.module';
import { TransactionCompensationService } from './transaction-compensation.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [
    NumeratorModule,
    JsonServerModule,
    HttpModule.register({ timeout: HTTP_TIMEOUT_MS }),
  ],
  providers: [TransactionsService, TransactionCompensationService],
  exports: [TransactionsService],
})
```

Also extend the header JSDoc with one sentence:

```text
Cycle B (TODO-06 §Task 2.2): provides `TransactionCompensationService` and
its own timeout-configured `HttpModule.register` instance (T3-D2 precedent)
for the orphaned-transaction DELETE retry loop.
```

### 5.4 EDIT `src/transactions/transactions.service.ts` (the ONLY service diff — G5)

**a) Imports (after the `CreateTransactionResponseDto` import):**

```typescript
import { TransactionCompensationService } from './transaction-compensation.service';
```

**b) Constructor — add the 4th parameter after `configService` (constructors are exempt from the 2-params rule — the class already had 3):**

```typescript
// BEFORE
  constructor(
    private readonly numeratorService: NumeratorService,
    private readonly jsonServerService: JsonServerService,
    private readonly configService: ConfigService,
  ) {}
// AFTER
  constructor(
    private readonly numeratorService: NumeratorService,
    private readonly jsonServerService: JsonServerService,
    private readonly configService: ConfigService,
    private readonly compensationService: TransactionCompensationService,
  ) {}
```

**c) `create()` — wrap ONLY the `createReceivable` call (replace lines 76–78):**

```typescript
// BEFORE
    const receivableResult = await this.jsonServerService.createReceivable(
      this.buildReceivablePayload({ dto, receivableId: ids.receivableId, transactionId: ids.transactionId }),
    );
// AFTER
    let receivableResult: ReceivableResponseDto;
    try {
      receivableResult = await this.jsonServerService.createReceivable(
        this.buildReceivablePayload({ dto, receivableId: ids.receivableId, transactionId: ids.transactionId }),
      );
    } catch (error) {
      await this.compensateOrphanedTransaction(ids.transactionId, error);
      throw error;
    }
```

**d) New private helper (place directly after `reserveIds()`):**

```typescript
  /**
   * Partial-failure compensation call-site (TODO-06 §Task 2.2, G5/CB-D6):
   * the transaction row already exists, so ANY receivable-write failure
   * triggers a bounded orphan-DELETE; the ORIGINAL error is then rethrown by
   * the caller so the exception filter's §2.1 mapping is unchanged.
   * `deleteTransaction` never throws (CB-D4 contract) and never masks the
   * receivable error; when the orphan survives, one inconsistency line with
   * ids + reason ONLY is logged (privacy T2-D7/G5).
   */
  private async compensateOrphanedTransaction(
    transactionId: string,
    receivableError: unknown,
  ): Promise<void> {
    const deleted = await this.compensationService.deleteTransaction(transactionId);
    if (!deleted) {
      const reason = receivableError instanceof Error
        ? receivableError.message
        : String(receivableError);
      this.logger.error(
        `orphaned transaction ${transactionId} could not be deleted — receivable failure: ${reason}`,
      );
    }
  }
```

**e) Header JSDoc — replace the "Error behaviour" paragraph (lines 8–16) with:**

```text
 * Error behaviour (TODO-06 §Task 2, cycle B): failures of `getNextId()` or
 * of the transaction write propagate untouched to the global
 * `AllExceptionsFilter` (APP_FILTER), which maps them per the §2.1 table
 * (Numerator errors → 503; json-server unknown/5xx → 503, 4xx → 502). The
 * ONLY try/catch wraps `createReceivable`: if it fails after the
 * transaction was persisted, the orphaned transaction is deleted by
 * `TransactionCompensationService` (bounded retries; goal = REDUCE orphans)
 * and the ORIGINAL receivable error is rethrown for the filter to map.
 * If compensation also fails, the inconsistency is logged (ids + reason
 * only) and the client still receives the error.
```

**Import note:** `ReceivableResponseDto` must be imported as a VALUE-usable type in the service. Check the existing import style: the service currently imports DTOs normally (not type-only) — keep a normal import; if `ReceivableResponseDto` is not yet imported there, add `import { ReceivableResponseDto } from './dto/receivable-response.dto';`. (If lint flags it as unused-elsewhere, it IS used — the `let receivableResult: ReceivableResponseDto;` annotation.)

## 6. Step 4 — Controller Swagger truth fix (commit 3, CB-D7)

Edit `src/transactions/transactions.controller.ts` — comment/metadata ONLY, no logic:

```typescript
// BEFORE (lines 21–26, JSDoc "Error behaviour" paragraph)
 * Error behaviour: domain errors (`NumeratorUnavailableError`,
 * `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError`,
 * `JsonServerRequestError`) propagate RAW from the service — the documented
 * 502/503 responses are produced once the Cycle-B global exception filter
 * (global plan G4) lands; until then they surface as the NestJS default 500.
 * The Swagger annotations below already document the target contract.
// AFTER
 * Error behaviour: domain errors (`NumeratorUnavailableError`,
 * `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError`,
 * `JsonServerRequestError`) are mapped by the global `AllExceptionsFilter`
 * (APP_FILTER, global plan G4): Numerator failures → 503, json-server
 * unknown/5xx → 503, json-server 4xx → 502; everything else → the
 * structured `{ statusCode, message, error }` body. A receivable failure
 * after the transaction was persisted also triggers compensation
 * (`TransactionCompensationService`), then the original error is mapped.
```

```typescript
// BEFORE (decorator descriptions)
  @ApiServiceUnavailableResponse({ description: 'Numerator or json-server unreachable (mapping lands with the Cycle-B exception filter).' })
  @ApiBadGatewayResponse({ description: 'json-server returned an unexpected 4xx (mapping lands with the Cycle-B exception filter).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error (mapping lands with the Cycle-B exception filter).' })
// AFTER
  @ApiServiceUnavailableResponse({ description: 'Numerator or json-server unreachable (upstream 5xx or network failure).' })
  @ApiBadGatewayResponse({ description: 'json-server returned an unexpected 4xx.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error.' })
```

## 7. Step 5 — Gates + temp runtime proof, then cleanup (no commit)

1. `npm run build` → must exit 0.
2. `npm run lint` → must exit 0 (it `--fix`es; inspect `git status` for unexpected mutations).
3. `npm test` → must exit 0 (`passWithNoTests`).
4. Create **temporary** `tmp-error-sanity.js` at the repo root (never commit; delete after):

```javascript
/* Temporary runtime proof for TODO-06 Cycle B (plan §7/CB-D8). NOT committed. */
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AllExceptionsFilter } = require('./dist/common/filters/all-exceptions.filter');
const { UnauthorizedException, BadRequestException, NotFoundException } = require('@nestjs/common');
const { NumeratorRetriesExhaustedError } = require('./dist/numerator/errors/numerator.errors');
const { JsonServerRequestError } = require('./dist/json-server/errors/json-server.errors');

function fakeHost() {
  let statusCode;
  let body;
  const response = {
    status(code) { statusCode = code; return response; },
    json(payload) { body = payload; return response; },
  };
  return {
    host: { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }) },
    result: () => ({ statusCode, body }),
  };
}

function assertEquals(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    process.exit(1);
  }
  console.log(`ok   ${label}`);
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const filter = new AllExceptionsFilter();

  let capture = fakeHost();
  filter.catch(new NumeratorRetriesExhaustedError(10, 3), capture.host);
  let r = capture.result();
  assertEquals(r.statusCode, 503, 'NumeratorRetriesExhaustedError -> 503');
  assertEquals(r.body.error, 'Service Unavailable', 'retries-exhausted phrase');
  if (!String(r.body.message).includes('after 10 attempts')) { console.error('FAIL retries-exhausted message'); process.exit(1); }

  capture = fakeHost();
  filter.catch(new JsonServerRequestError({ resource: 'receivables', status: 400, reason: 'Request failed with status code 400' }), capture.host);
  r = capture.result();
  assertEquals(r.statusCode, 502, 'JsonServerRequestError 400 -> 502');
  assertEquals(r.body.error, 'Bad Gateway', '4xx phrase');

  capture = fakeHost();
  filter.catch(new JsonServerRequestError({ resource: 'transactions', status: undefined, reason: 'timeout of 4000ms exceeded' }), capture.host);
  assertEquals(capture.result().statusCode, 503, 'JsonServerRequestError undefined -> 503');

  capture = fakeHost();
  filter.catch(new JsonServerRequestError({ resource: 'transactions', status: 502, reason: 'upstream 5xx' }), capture.host);
  assertEquals(capture.result().statusCode, 503, 'JsonServerRequestError 502 -> 503');

  capture = fakeHost();
  filter.catch(new Error('boom'), capture.host);
  r = capture.result();
  assertEquals(r.statusCode, 500, 'unknown -> 500');
  assertEquals(r.body, { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }, 'generic 500 body');

  capture = fakeHost();
  filter.catch(new UnauthorizedException('Missing or invalid x-api-key header'), capture.host);
  r = capture.result();
  assertEquals(r.statusCode, 401, 'HttpException 401 passthrough status');
  assertEquals(r.body, { statusCode: 401, message: 'Missing or invalid x-api-key header', error: 'Unauthorized' }, '401 body shape');

  capture = fakeHost();
  filter.catch(new BadRequestException(['value must be a positive decimal string', 'cardCvv must be a valid CVV']), capture.host);
  r = capture.result();
  assertEquals(r.statusCode, 400, 'ValidationPipe-shaped 400 status');
  assertEquals(Array.isArray(r.body.message), true, '400 message stays an ARRAY');

  capture = fakeHost();
  filter.catch(new NotFoundException('Cannot GET /nope'), capture.host);
  r = capture.result();
  assertEquals(r.statusCode, 404, 'router 404 passthrough');
  assertEquals(r.body.message, 'Cannot GET /nope', '404 message passthrough');

  await app.close();
  console.log('ERROR-SANITY-OK');
}

main().catch((error) => { console.error(error); process.exit(1); });
```

5. `node tmp-error-sanity.js` → must print `ERROR-SANITY-OK` and exit 0.
6. Delete `tmp-error-sanity.js` (verify with `git status` that the tree holds ONLY the committed/new source files).
7. Run `npm run lint` a second time → exit 0.

## 8. Step 6 — Reviewer handoff notes (4.3 inputs)

- Code-reviewer checkpoints: R2 pass-through regression (the 400-array-message proof), R3 (original error rethrown — the `throw error` AFTER `await compensate…`), zero diffs under `src/numerator/` + `src/json-server/` (`git diff --stat` must show none), no second try/catch in the service.
- Code-simplifier: any simplification proposal goes to its own plan file; the try/catch placement and the filter dispatch are FIXED by this plan and must not be "simplified" away.

## 9. Verification table — every TODO §Task 2 bullet → step + evidence

| TODO bullet | Plan step | Evidence |
|---|---|---|
| §2.1 DTO validation → 400 (must not break) | Steps 3 (pass-through branch) + 7 | tmp script "ValidationPipe-shaped 400 … message stays an ARRAY"; live recipe §11.2 |
| §2.1 missing/invalid API key → 401 (must not break) | Steps 3 + 7 | tmp script 401 body deep-equal; live recipe §11.1 |
| §2.1 Numerator unreachable / retries exhausted → 503 | Step 3 (`resolveDomainBody`) | tmp script NumeratorRetriesExhaustedError → 503 (+ message contains "after 10 attempts") |
| §2.1 json-server unreachable or 5xx → 503 | Step 3 (`mapJsonServerStatus`) | tmp script: `status: undefined` → 503, `status: 502` → 503 |
| §2.1 json-server 4xx (unexpected) → 502 (**decided over the "or 500" alternative**) | Step 3; rationale CB-D2/G4 | tmp script `status: 400` → 502 + phrase `Bad Gateway`. WHY 502 over 500: the failure is an UPSTREAM contract anomaly behind this gateway — 502 states "the thing I proxy answered wrongly", which is more truthful for clients than 500 "I broke"; also matches the Cycle-A Swagger `@ApiBadGatewayResponse` already shipped |
| §2.1 unexpected internal error → 500 generic fallback | Step 3 (unknown branch) | tmp script `new Error('boom')` → exact generic body |
| §2.1 details in messages | CB-D2b (verbatim `err.message`) | tmp script message assertions |
| §2.2 delete the just-created transaction on receivable failure | Steps 5.2 + 5.4 | `compensateOrphanedTransaction` + `DELETE /transactions/:id` via HttpService |
| §2.2 deletion in another class, retry loop with sleep + max retries | Step 5.1–5.2 (CB-D4) | `TransactionCompensationService` loop: 3 attempts, `min(200 × 2^idx, 1600)` sleeps between attempts |
| §2.2 compensation also failing → log inconsistency + still error the client | Step 5.4d (`logger.error` ids+reason) + rethrow original | G5/R3; reviewer checkpoint §8 |
| §2.2 goal = reduce, not eliminate, orphans | CB-D4 constants (3 attempts, capped backoff) | no saga/circuit breaker added |
| §2.3 global filter, consistent `{ statusCode, message, error }` | Steps 3–4 | every tmp-script body has exactly the 3 keys |
| §2.3 no stack leak when NODE_ENV=production | CB-D3 (generic 500 body in ALL envs; stack only via Logger.error) | tmp script unknown-error body equals generic — no stack field exists to leak |
| Global plan G4 filter location + APP_FILTER registration | Steps 1, 4 | `src/common/filters/all-exceptions.filter.ts` + app.module provider |
| Global plan G5 no client-package edits | §2 Frozen list | `git diff --stat` shows zero diffs under `src/numerator/`, `src/json-server/` |
| Global plan G9 gates | Step 7 | build/lint×2/test exit 0 + `ERROR-SANITY-OK` |

## 10. Out-of-scope guard list (implementer MUST NOT touch)

1. Any file under `src/numerator/` or `src/json-server/` (imports allowed, diffs forbidden).
2. DTOs, validators, enums, `config.keys.ts`, `env.validation.ts`, `main.ts`, `package.json` (NO new dependency — `http-status` etc. forbidden), `.env.example`, docker files.
3. Unit/e2e test files (TODO-07), Swagger docs beyond the CB-D7 description strings, interceptors, rate limiting, circuit breakers.
4. `.agent/project-structure.md`, `architecture.md`, `docs/**` — these belong to step 4.4 (docs-specialist), which must add: the `src/common/filters/` folder line + transactions compensation mention in `.agent/project-structure.md`; the "Error & Response Conventions" flip in `architecture.md` (planned → live); `docs/app-setup.md` error-table section + the user fault-injection recipes of §11 below.
5. Branch creation/switch, version bump, push — restricted to workflow steps 2/3/5.
6. Any "improvement" to Cycle-A code beyond the CB-D7 truth fix (controller logic is frozen).

## 11. §User-manual-test additions (fault-injection recipes — user-run only; agents never run docker/HTTP)

For the 4.4 docs step to append to `docs/app-setup.md` (PowerShell, `curl.exe`; prerequisites: `docker compose up` + `npm run start:dev`):

1. **401:** `curl.exe -i -X POST http://localhost:3001/v1/transactions` (no header) → 401 + `{"statusCode":401,"error":"Unauthorized","message":"Missing or invalid x-api-key header"}`.
2. **400:** valid key + `"value":"-5"` → 400 with `message` as an array of validator strings, `error: "Bad Request"`.
3. **503 (Numerator down):** `docker compose stop numerator-api` → valid POST → `503 {"statusCode":503,"message":"connect ECONNREFUSED …","error":"Service Unavailable"}`; restart with `docker compose start numerator-api`.
4. **503 (json-server down):** `docker compose stop json-server` → valid POST → 503 (fails at the FIRST write, before any persistence — no orphan, nothing to compensate); restart.
5. **502 / receivable-only failure (compensation path):** NOT forceable via configuration alone (it needs json-server to accept the transaction POST but reject the receivable POST); documented honestly as deferred to the TODO-07 test cycle — no fake recipe is provided.
6. **Production stack check:** set `NODE_ENV=production` in `.env`, restart, run recipe 3 → the 503 body is still the structured 3-key body with NO stack trace; the stack appears only on the server console via the Nest logger (for the unknown-error branch, any unhandled crash logs `Unhandled exception: …` server-side while the client gets the generic 500).

## 12. Rule-compliance checklist (G8 — per new file, verify before commit)

| File | ≤200 lines (≤125 effective) | methods ≤50 lines | nesting ≤2 | ≤2 params/method | private members | self-documenting | no commented code | JSDoc header |
|---|---|---|---|---|---|---|---|---|
| `src/common/filters/all-exceptions.filter.ts` | ~115/~75 ✓ | `catch` ~12, helpers ≤10 ✓ | 2 ✓ | `catch(exception, host)` — framework signature, 2 ✓ | all helpers private ✓ | ✓ | ✓ | ✓ |
| `src/transactions/transaction-compensation.service.ts` | ~120/~80 ✓ | `deleteTransaction` ~10, `handleDeleteFailure` ~20 ✓ | 2 ✓ | ctor 2 (HttpService, ConfigService) ✓; helpers ≤2 via `CompensationFailureContext` ✓ | all except the 2 DI params + the public `deleteTransaction` ✓ | ✓ | ✓ | ✓ |
| `src/common/constants/compensation.constants.ts` | ~20 ✓ | n/a | n/a | n/a | exports are the point ✓ | ✓ | ✓ | ✓ |
| `src/transactions/transactions.service.ts` (edited) | ~150 ✓ | `create` ~20, `compensateOrphanedTransaction` ~14 ✓ | try/catch depth 1 ✓ | helper exactly 2 ✓ | ✓ | ✓ | ✓ | header updated |

## 13. Expected final line counts

| File | Before | After |
|---|---|---|
| `src/common/filters/all-exceptions.filter.ts` | — | ~115 |
| `src/transactions/transaction-compensation.service.ts` | — | ~120 |
| `src/common/constants/compensation.constants.ts` | — | ~20 |
| `src/transactions/transactions.service.ts` | 124 | ~150 |
| `src/transactions/transactions.module.ts` | 32 | ~40 |
| `src/app.module.ts` | 49 | ~55 |
| `src/transactions/transactions.controller.ts` | 78 | ~76 (comment-only trim) |

All ≤200 (G8) — no service split into further files is needed; the CB-D4 "compensation orchestrator receives {transactionId, receivableError}" concern is fulfilled by the `compensateOrphanedTransaction` helper (2 params) keeping `create()` readable.

## 14. Commit plan for 4.2 (implementer)

1. `feat: add global all-exceptions filter with domain error mapping` — Steps 1 + 2 (filter + APP_FILTER wiring).
2. `feat: compensate orphaned transactions on receivable write failure` — Step 5 (constants + compensation service + module + service try/catch).
3. `docs: mark error mapping live in transactions controller Swagger descriptions` — Step 6 (truth fix).

(Commit messages may be adjusted to match repo style; the 3-way split is fixed.)

## 15. Deviation register (CB-D1…CB-D8 summary, all pre-decided — none require user input)

- **CB-D1** single catch-all `AllExceptionsFilter` + private helpers over a two-class split; APP_FILTER registration.
- **CB-D2** body shape `{ statusCode, message, error }`; local phrase map, no new dep; HttpException passthrough as-is (array messages preserved); domain `message` = `err.message` verbatim.
- **CB-D3** log-only production rule: filter has NO ConfigService/NODE_ENV dependency; generic 500 body in all environments; stack only server-side.
- **CB-D4** flat `transaction-compensation.service.ts`; `Promise<boolean>` contract, never throws; 404 = success; inline sleep; constants 3 / 200 / 1600; no new env keys.
- **CB-D5** TransactionsModule gets its own `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })`; compensation service not exported.
- **CB-D6** the single service try/catch catches ANY `createReceivable` failure (transaction already persisted), compensates, rethrows ORIGINAL; numerator failures stay outside the try (pre-write, zero-orphan).
- **CB-D7** controller Swagger-description truth fix ships in 4.2 (commit 3), not deferred to 4.4.
- **CB-D8** verification = build + lint×2 + test + temp `tmp-error-sanity.js` direct-filter-invocation proof (no supertest boot); temp file deleted, never committed.
