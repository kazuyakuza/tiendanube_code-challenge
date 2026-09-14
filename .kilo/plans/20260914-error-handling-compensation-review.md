# Code Review Findings — TODO-06 Cycle B (step 4.3, Cycle B)

**Scope:** commits `2416915` + `1b73935` + `271c94b` on `feat/transactions-endpoint`.
**Files reviewed:**
- `src/common/filters/all-exceptions.filter.ts` (new)
- `src/common/constants/compensation.constants.ts` (new)
- `src/transactions/transaction-compensation.service.ts` (new)
- `src/app.module.ts`
- `src/transactions/transactions.module.ts`
- `src/transactions/transactions.service.ts`
- `src/transactions/transactions.controller.ts`

**Binding sources used:** `.agent/todos/20260913/20260913-todo-6.md` §2.1–§2.3, `.kilo/plans/20260914-error-handling-compensation.md` (CB-D1…CB-D8 + verification table), `.kilo/plans/20260914-transactions-endpoint.md` (G4/G5/G7/G8/G10), `.kilo/rules/single-section-boolean-conditions.md`, `.kilo/rules/max-lines-per-file.md`, `.kilo/rules/max-lines-per-method.md`, `.kilo/rules/max-depth.md`, `.kilo/rules/max-arguments-per-method.md`, `.kilo/rules/prefer-private-members.md`, `.kilo/rules/no-commented-code.md`.

---

## Findings Table

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | §2.1 mapping exact: ValidationPipe 400 / guard 401 / router 404 pass-through | Filter checks `instanceof HttpException` first; `toHttpExceptionBody` returns object payload as-is (ValidationPipe `message` array survives) and wraps string payloads with `{statusCode, message, error}`. UnauthorizedException → 401, NotFoundException → 404, BadRequestException(object) → 400. | PASS |
| 1a | Numerator errors → 503 | `resolveDomainBody` maps all three numerator error classes to `HttpStatus.SERVICE_UNAVAILABLE`. | PASS |
| 1b | json-server unreachable/5xx → 503; 4xx → 502 | `mapJsonServerStatus`: `undefined` or `>=500` → 503; otherwise → 502. Matches CB-D2/G4 decision. | PASS |
| 1c | 500 fallback for unknown errors | Unknown branch logs via `Logger.error` and sends `INTERNAL_ERROR_BODY` (`{statusCode:500, message:'Internal server error', error:'Internal Server Error'}`). | PASS |
| 1d | Domain messages preserved verbatim | `buildBody` uses `exception.message` unchanged. | PASS |
| 2 | Single-section boolean conditions rule | `resolveDomainBody` contains `if (exception instanceof A \|\| exception instanceof B \|\| exception instanceof C)`. `mapJsonServerStatus` contains `if (status === undefined \|\| status >= 500)`. Both are multi-section booleans inside `if` statements. | **FAIL — rule deviation** |
| 3a | Compensation: exactly 3 total attempts, sleep only between | `for (let attempt = 1; attempt <= COMPENSATION_MAX_ATTEMPTS; attempt++)`; sleep is called only when `attempt < COMPENSATION_MAX_ATTEMPTS` inside `handleDeleteFailure`. | PASS |
| 3b | Backoff math `200×2^(attempt−1)` capped 1600 | `computeBackoffDelay(1)=200`, `computeBackoffDelay(2)=400`, capped at 1600. | PASS |
| 3c | 404 idempotency does not leak false orphan | `isAlreadyAbsent` returns `true` → success log, no exhaustion error. | PASS |
| 3d | `deleteTransaction` never throws | All `firstValueFrom` calls wrapped in `try/catch`; `handleDeleteFailure` returns boolean; no throw paths. | PASS |
| 3e | Success path logs | `logger.warn` on 2xx delete and on 404-already-absent. | PASS |
| 3f | Exhaustion logs one error line with ids+reason only | `logger.error(\`compensation exhausted — transaction ${id} may remain orphaned, last reason=${reason}\`)`. | PASS |
| 3g | Privacy: no payloads/upstream bodies in logs | Reasons come from `error.message` or `String(error)`; `JsonServerRequestError` message is built from resource + status + axios reason only. | PASS |
| 4a | Service try/catch wraps ONLY `createReceivable` | Lines 80–88 in `transactions.service.ts`; only the `jsonServerService.createReceivable` call is inside the try. | PASS |
| 4b | Rethrow is the same error object | `throw error` after `await compensateOrphanedTransaction(...)`. | PASS |
| 4c | Compensation awaited before rethrow | `await this.compensateOrphanedTransaction(...)` precedes `throw error`. | PASS |
| 4d | No try/catch in controller | `transactions.controller.ts` has no try/catch. | PASS |
| 4e | No try/catch around compensation call-site | `compensateOrphanedTransaction` invokes `deleteTransaction` without a local try/catch. | PASS |
| 4f | Helper params ≤2 | `compensateOrphanedTransaction(transactionId, receivableError)` has exactly 2 params. | PASS |
| 5 | `APP_FILTER` from `@nestjs/core`, globally registered | `src/app.module.ts` imports `{ APP_FILTER, APP_GUARD } from '@nestjs/core'` and provides `{ provide: APP_FILTER, useClass: AllExceptionsFilter }`. | PASS |
| 6 | Controller diff = comments/strings only | `git show 271c94b` shows only JSDoc and Swagger `description` string changes; zero executable-line changes. | PASS |
| 7 | Frozen surfaces zero diff | `git diff --name-only 2416915^ 271c94b` lists only the 7 expected files; `src/numerator/`, `src/json-server/`, DTOs, config, `package*.json` untouched. | PASS |
| 8 | Build/lint sanity | `npm run build` exit 0; `npm run lint` exit 0; lint produced no source-file mutations. | PASS |

---

## Required Fix

**Rule:** `.kilo/rules/single-section-boolean-conditions.md`

The new `AllExceptionsFilter` violates the rule in two places:

1. `resolveDomainBody` line 104–108: triple `instanceof` disjunction inside an `if`.
2. `mapJsonServerStatus` line 118: `status === undefined || status >= 500` inside an `if`.

Both must be extracted into private boolean helpers so the original `if` statements become single-section.

This is a **small, behavior-preserving, local refactor** only; it does not change error-mapping semantics, response shapes, or compensation logic.

---

## Fix Plan — Exact Minimal Diff

### File: `src/common/filters/all-exceptions.filter.ts`

#### Change A — extract `isNumeratorError()`

Replace the multi-section `if` in `resolveDomainBody` with a helper call, and add the helper.

```diff
   private resolveDomainBody(exception: unknown): ErrorResponseBody | undefined {
-    if (
-      exception instanceof NumeratorUnavailableError ||
-      exception instanceof NumeratorRetriesExhaustedError ||
-      exception instanceof InvalidNumeratorValueError
-    ) {
+    if (this.isNumeratorError(exception)) {
       return this.buildBody(HttpStatus.SERVICE_UNAVAILABLE, exception.message);
     }
     if (exception instanceof JsonServerRequestError) {
```

Add the private helper after `resolveDomainBody` (before `mapJsonServerStatus`):

```diff
+  private isNumeratorError(exception: unknown): boolean {
+    return (
+      exception instanceof NumeratorUnavailableError ||
+      exception instanceof NumeratorRetriesExhaustedError ||
+      exception instanceof InvalidNumeratorValueError
+    );
+  }
+
   private mapJsonServerStatus(status: number | undefined): number {
```

#### Change B — extract `isUpstreamFailure()`

Replace the two-section `if` in `mapJsonServerStatus` with a helper call, and add the helper.

```diff
   private mapJsonServerStatus(status: number | undefined): number {
-    if (status === undefined || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
+    if (this.isUpstreamFailure(status)) {
       return HttpStatus.SERVICE_UNAVAILABLE;
     }
     return HttpStatus.BAD_GATEWAY;
   }
+
+  private isUpstreamFailure(status: number | undefined): boolean {
+    return status === undefined || status >= HttpStatus.INTERNAL_SERVER_ERROR;
+  }
```

### Expected impact

- File length grows from 132 to ~141 lines (still well under the 200-line limit).
- All existing method bodies remain under 50 lines.
- No change to HTTP status mapping, message passthrough, or logging behavior.

---

## Re-verification Command Sequence

After applying the fix, run exactly this sequence and confirm each step exits 0:

```powershell
npm run build
npm run lint
npm run lint   # second pass because --fix may mutate files
```

Then confirm the diff touches only `src/common/filters/all-exceptions.filter.ts`:

```powershell
git diff --name-only
```

Finally, confirm frozen surfaces are still untouched:

```powershell
git diff --name-only HEAD -- src/numerator src/json-server src/config src/main.ts package.json package-lock.json .env.example docker-compose.yml
```

Expected result: the last command prints nothing.
