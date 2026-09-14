# Implementation Plan — Task 1: Numerator Client (TODO-04)

- **TODO file**: `.agent/todos/20260913/20260913-todo-4.md` — **Task 1 ONLY** (§Task 1 + cross-cutting "Configuration & resilience" bullets)
- **Branch**: `feat/external-clients` (already created in workflow step 2 — do NOT create/switch branches)
- **Version**: already bumped to `0.3.0` in step 3 — do NOT touch `package.json`
- **Global plan**: `.kilo/plans/20260913-external-clients.md` (decisions G1–G9, G13, G16, G18, G19 binding here)
- **Front-end related**: NO (4.1a/4.5a omitted). **Tests**: NONE (TODO explicit out of scope).
- **Executor**: JUNIOR developer under 50% restriction — every structural decision is encoded below; do not deviate, do not expand scope. If anything is ambiguous, STOP and ask the caller.

---

## 0) Scope & Out of Scope

### In scope (exactly this)

| Artifact | Purpose |
|---|---|
| `src/numerator/numerator.service.ts` | `NumeratorService.getNextId(): Promise<string>` with CAS retry loop (G5/G6/G7/G9), private low-level methods (TODO §1.5) |
| `src/numerator/numerator.module.ts` | Minimal `@Module` (decision T1-D1) |
| `src/numerator/numerator.constants.ts` | Retry/backoff defaults + caps (G1/G2/G4) |
| `src/numerator/errors/numerator.errors.ts` | 3 domain error classes (G8) |
| `src/numerator/interfaces/*.ts` | Param objects + wire shapes (max-2-params rule) |
| `src/config/env.validation.ts` | 2 new optional int vars + JSDoc consumption-map update (G1/G2) |
| `src/config/config.keys.ts` | 2 new keys + JSDoc consumption-map update (G1/G2) |
| `.env.example` | Documented optional entries (G1/G2/G3) |
| `.agent/project-structure.md` | Add `src/numerator/` line (deviation T1-D3 from G15) |

### Out of scope — do NOT touch

- `src/json-server/**` (Task 2), `src/app.module.ts`, HttpModule timeout config (Task 3 — the timeout literal `4000` and `HttpModule.register` upgrade belong to Task 3), controllers, orchestration, fee logic, unit/e2e tests, docker commands, `README.md`/`docs/` authoring (step 4.4 owns docs), local `.env` (user-owned, gitignored — NEVER edit), `.agent/todos/20260913/*.md` (untracked user files — NEVER stage/commit), `package.json`.

---

## 1) Research Findings (evidence)

1. **Numerator mock contract** (`numerator-api/api.js`):
   - `GET /numerator` → 200 `{ numerator: <number> }` (api.js:34–41); on internal failure → 500 `{ error }`.
   - `PUT /numerator/test-and-set` body `{ oldValue, newValue }` (api.js:58–75):
     - invalid body types (non-number/NaN) → **400 `{ error: "Invalid values for test-and-set." }` — NO `currentNumerator`** (api.js:60–62);
     - CAS mismatch → **400 `{ error, currentNumerator: <number> }`** (api.js:65–70);
     - success → 200 `{ numerator: newValue }` (api.js:71).
   - Mock starts at value **3** (`numerator-api/numerator.js:1`).
   - → The presence of a numeric `currentNumerator` in a 400 body is the ONLY reliable conflict discriminator (G5). A 400 without it (invalid-params shape) must NOT retry.
2. **`@nestjs/axios` 4.0.1** (installed, `node_modules/@nestjs/axios/package.json`):
   - `HttpService.get<T>/put<T>(url, data?, config?)` return `Observable<AxiosResponse<T, D>>` (`dist/http.service.d.ts`) → convert with `firstValueFrom` from `rxjs` (rxjs 7.8.2 installed).
   - **`HttpModule` has NO `forRoot` in v4** — only `static register(config)` / `registerAsync` (`dist/http.module.d.ts`). Bare `imports: [HttpModule]` IS valid: the class is decorated with `@Module({ providers: [HttpService, { provide: AXIOS_INSTANCE_TOKEN, useValue: axios }], exports: [HttpService] })` (`dist/http.module.js` bottom) → the minimal T1-D1 module compiles and DI-resolves.
   - **Finding for Task 3 (not this task's code)**: G12's `HttpModule.forRoot({ timeout })` must be implemented as `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` in v4.
3. **`axios` 1.20.0** (installed): `export function isAxiosError<T, D, P>(payload: any): payload is AxiosError<T, D, P>` is a **standalone named export** (`node_modules/axios/index.d.ts` ~line 749) — NOT a static on the `AxiosError` class (class exposes `from`, error-code statics only, ~line 524–560). `AxiosError.response?: AxiosResponse<T>` with `data: T`, `status: number`. → Use `isAxiosError(error)` as a type guard; generic `isAxiosError<CasConflictResponseBody>(error)` types `error.response.data` for safe property access. (Correction vs. prompt shorthand `AxiosError.isAxiosError` — same pattern as the T5 `APP_GUARD` import correction.)
4. **House style** (mirror exactly):
   - `src/config/env.validation.ts` — PORT pattern: `@Type(() => Number) @IsInt() @Min(1)`; optional pattern: `@IsOptional()` first; JSDoc "consumption map" paragraph in file header (lines 17–25); file currently 120 lines (< 200 limit).
   - `src/config/config.keys.ts` — `ConfigKeys` `as const` object + `ConfigKey` union type; JSDoc consumption map (lines 13–19).
   - `src/main.ts:50` — optional read style: `configService.get<boolean>(ConfigKeys.SwaggerEnabled, true)` → mirror with `get<number>(key, DEFAULT)`.
   - `src/common/guards/api-key.guard.ts` — module-level helper function at file bottom (`isAuthorizedKey`) after the class; `getOrThrow<string>(ConfigKeys.ApiKey)` style.
   - `src/health/health.module.ts` — minimal `@Module` + file-header JSDoc explaining imports/exports.
   - `src/common/constants/payment-fee.constants.ts` — named-constant file style: JSDoc header with "AI-agent guidance" block, exported consts.
   - `src/common/utils/card-number.util.ts` — pure-function JSDoc style.
5. **tsconfig/eslint**: `strictNullChecks: true`, no `verbatimModuleSyntax` (mixed type+value imports from `axios` OK); `tseslint.configs.recommended` → no `any`, no unused vars; `target: ES2021` → `2 **` exponent OK. `npm run lint` auto-fixes (`--fix`) — re-check `git status` after lint.
6. **Rules binding the code** (`.kilo/rules/`): ≤200 lines/file, ≤50-line method bodies, ≤2 params (else typed param object in a new file), ≤2 nesting depth, private-by-default members, single-section boolean conditions (multi-section predicates extracted into named methods), no commented-out code, self-documenting names, all source in `src/`.

---

## 2) Files to Create / Modify

| # | File | Action | Commit |
|---|---|---|---|
| 1 | `src/config/env.validation.ts` | modify (2 fields + JSDoc map) | A |
| 2 | `src/config/config.keys.ts` | modify (2 keys + JSDoc map) | A |
| 3 | `.env.example` | modify (2 commented optional entries) | A |
| 4 | `src/numerator/numerator.constants.ts` | create | B |
| 5 | `src/numerator/errors/numerator.errors.ts` | create | B |
| 6 | `src/numerator/interfaces/numerator-api.interfaces.ts` | create | B |
| 7 | `src/numerator/interfaces/cas-attempt-result.interface.ts` | create | B |
| 8 | `src/numerator/interfaces/cas-failure-context.interface.ts` | create | B |
| 9 | `src/numerator/numerator.service.ts` | create | C |
| 10 | `src/numerator/numerator.module.ts` | create | C |
| 11 | `.agent/project-structure.md` | modify (add `src/numerator/` line) | D |

---

## 3) Steps (execute in order; single commands only — Windows PowerShell shell)

> General discipline for EVERY step: before each commit run `git status` and verify (a) you are on `feat/external-clients`, (b) only the files listed for that commit are staged, (c) `.agent/todos/20260913/*.md` and `.env` are NEVER staged. If `npm run lint` auto-fixed files, add them to the currently pending commit.

### Step 1 — Preflight (read-only)

1. Run: `git status` → expect: branch `feat/external-clients`, clean tree except untracked `.agent/todos/20260913/20260913-todo-4.md` and `20260913-todo-5.md`. If anything else is dirty, STOP and report to caller.
2. Run: `git branch --show-current` → expect `feat/external-clients`.
3. Read `.gitignore` (gitignore-compliance rule).

### Step 2 — Config plumbing (Commit A)

**2.1 Edit `src/config/env.validation.ts`:**

- In the file-header JSDoc, replace the consumption-map paragraph (lines starting `* - Consumption map: PORT / NODE_ENV ...` through `... *validated* at bootstrap.`) with EXACTLY:

```text
 * - Consumption map: PORT / NODE_ENV / CORS_ORIGINS / SWAGGER_ENABLED →
 *   `main.ts` bootstrap (T3, implemented; required keys via `getOrThrow`,
 *   `SWAGGER_ENABLED` via `get(key, true)` — plan addendum A3-R); API_KEY →
 *   global ApiKeyGuard (T5, implemented — `src/common/guards/api-key.guard.ts`,
 *   read via `getOrThrow`); NUMERATOR_API_URL / MAX_RETRIES /
 *   NUMERATOR_BASE_BACKOFF_MS → NumeratorService (TODO-04 Task 1,
 *   implemented — `src/numerator/numerator.service.ts`; URL via `getOrThrow`,
 *   the two optional knobs via `get(key, default)`); JSON_SERVER_URL →
 *   json-server client (TODO-04 Task 2 — the only key still without a
 *   consumer). TRANSACTIONS_RETURN_BODY → transactions controller (TODO-04;
 *   plumbing only as of TODO-03 §2.4). All ten are *validated* at bootstrap.
```

- Inside `class EnvironmentVariables`, AFTER the `TRANSACTIONS_RETURN_BODY` field, append EXACTLY:

```ts
  /** Optional; absent keeps the Numerator client default of 10 total CAS attempts (TODO-04 §1.3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_RETRIES: number;

  /** Optional; absent keeps the Numerator client base backoff of 20 ms (TODO-04 §1.3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  NUMERATOR_BASE_BACKOFF_MS: number;
```

(No field initializers — the in-code defaults live ONLY in `src/numerator/numerator.constants.ts`; no new imports needed — `IsOptional`, `Type`, `IsInt`, `Min` are already imported.)

**2.2 Edit `src/config/config.keys.ts`:**

- In the `ConfigKeys` object, after the `TransactionsReturnBody: 'TRANSACTIONS_RETURN_BODY',` line, append EXACTLY:

```ts
  MaxRetries: 'MAX_RETRIES',
  NumeratorBaseBackoffMs: 'NUMERATOR_BASE_BACKOFF_MS',
```

- Replace the JSDoc consumption-map paragraph (lines `* Consumption map: Port / NodeEnv ...` through `... as of TODO-03 §2.4.`) with EXACTLY:

```text
 * Consumption map: Port / NodeEnv / CorsOrigins / SwaggerEnabled → main.ts
 * bootstrap (TODO-02 §3, implemented, per plan addendum A3-R); ApiKey →
 * global ApiKeyGuard (§5, T5, implemented — `src/common/guards/api-key.guard.ts`,
 * registered via `APP_GUARD` in `app.module.ts`); NumeratorApiUrl /
 * MaxRetries / NumeratorBaseBackoffMs → NumeratorService (TODO-04 Task 1,
 * implemented — `src/numerator/numerator.service.ts`; URL via `getOrThrow`,
 * optional knobs via `get(key, default)`); JsonServerUrl → json-server
 * client (TODO-04 Task 2 — the only key still without a consumer).
 * TransactionsReturnBody → transactions controller (TODO-04; plumbing only
 * as of TODO-03 §2.4).
```

**2.3 Edit `.env.example`:** append at end of file EXACTLY:

```text

# Optional: Numerator client resilience knobs (in-code defaults apply when absent)
# MAX_RETRIES=10
# NUMERATOR_BASE_BACKOFF_MS=20
```

**2.4 Verify:** run `npm run build` → expect exit 0, no output errors.

**2.5 Commit:**

- `git add src/config/env.validation.ts src/config/config.keys.ts .env.example`
- `git commit -m "feat(config): add optional MAX_RETRIES and NUMERATOR_BASE_BACKOFF_MS knobs"`

### Step 3 — Constants, errors, interfaces (Commit B)

**3.1 Create `src/numerator/numerator.constants.ts`** (full content):

```ts
/**
 * Numerator client tuning constants (TODO-04 §1.3, global plan G1/G2/G4).
 *
 * MAX_RETRIES and NUMERATOR_BASE_BACKOFF_MS are OPTIONAL env vars — these
 * constants are their in-code defaults, so existing `.env` files keep booting
 * unchanged (G3). `MAX_NUMERATOR_BACKOFF_MS` caps the light exponential
 * backoff curve `min(base * 2^retryIndex, cap)`; `CAS_CONFLICT_STATUS` names
 * the HTTP status the mock returns on a CAS conflict (magic-number rule).
 *
 * AI-agent guidance: do not re-declare these numbers elsewhere; the retry
 * semantics live in `numerator.service.ts` and the env plumbing in
 * `src/config/env.validation.ts` / `config.keys.ts`.
 */

/** Default total CAS attempts per `getNextId()` call (env `MAX_RETRIES`). */
export const NUMERATOR_DEFAULT_MAX_RETRIES = 10;

/** Default base backoff in ms for the first retry (env `NUMERATOR_BASE_BACKOFF_MS`). */
export const NUMERATOR_DEFAULT_BASE_BACKOFF_MS = 20;

/** Upper bound of the exponential backoff curve, in ms. */
export const MAX_NUMERATOR_BACKOFF_MS = 160;

/** HTTP status the Numerator mock returns for a CAS conflict. */
export const CAS_CONFLICT_STATUS = 400;
```

**3.2 Create `src/numerator/errors/numerator.errors.ts`** (full content):

```ts
/**
 * Domain error classes for the Numerator client (TODO-04 §1.4, global plan G8).
 *
 * Taxonomy:
 * - `NumeratorUnavailableError` — the Numerator service could not be used:
 *   network/timeout failures, 5xx, or any unexpected HTTP status. Carries the
 *   underlying message; the axios stack is intentionally NOT propagated.
 * - `NumeratorRetriesExhaustedError` — every CAS attempt conflicted. Carries
 *   the configured attempt budget and the last current value observed, if any.
 * - `InvalidNumeratorValueError` — the API returned a non-finite/non-numeric
 *   numerator, or the candidate overflowed the safe-integer range. Carries the
 *   offending raw value.
 *
 * AI-agent guidance: mapping these to HTTP responses (e.g. 503) is the
 * orchestration layer's job, NOT this client's (global plan G18) — no status
 * codes belong in this file.
 */

export class NumeratorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NumeratorUnavailableError';
  }
}

export class NumeratorRetriesExhaustedError extends Error {
  readonly maxRetries: number;
  readonly lastKnownCurrent: number | undefined;

  constructor(maxRetries: number, lastKnownCurrent?: number) {
    const currentSuffix =
      lastKnownCurrent === undefined ? '' : ` (last known current: ${lastKnownCurrent})`;
    super(`Numerator ID reservation failed after ${maxRetries} attempts${currentSuffix}`);
    this.name = 'NumeratorRetriesExhaustedError';
    this.maxRetries = maxRetries;
    this.lastKnownCurrent = lastKnownCurrent;
  }
}

export class InvalidNumeratorValueError extends Error {
  readonly rawValue: unknown;

  constructor(rawValue: unknown) {
    super(`Numerator returned an invalid value: ${String(rawValue)}`);
    this.name = 'InvalidNumeratorValueError';
    this.rawValue = rawValue;
  }
}
```

**3.3 Create `src/numerator/interfaces/numerator-api.interfaces.ts`** (full content — one file holds the three wire shapes of the single Numerator API contract):

```ts
/**
 * Wire shapes of the provided Numerator mock API (`numerator-api/api.js`,
 * TODO-04 §1.2). Transport types only — no validation logic here; runtime
 * values are validated in `NumeratorService` before use.
 *
 * AI-agent guidance: `NumeratorCurrentResponseBody.numerator` is typed
 * `unknown` DELIBERATELY — the service must prove it is a finite number
 * (global plan G7) instead of trusting the wire.
 */

/** `GET /numerator` success body. */
export interface NumeratorCurrentResponseBody {
  numerator: unknown;
}

/** `PUT /numerator/test-and-set` success body (`{ numerator: newValue }`). */
export interface CasSuccessResponseBody {
  numerator: number;
}

/**
 * `PUT /numerator/test-and-set` 400 body. The mock emits TWO variants:
 * CAS conflict → `{ error, currentNumerator }`; invalid params →
 * `{ error }` WITHOUT `currentNumerator`. Only the first is a retryable
 * conflict (global plan G5).
 */
export interface CasConflictResponseBody {
  error?: string;
  currentNumerator?: number;
}
```

**3.4 Create `src/numerator/interfaces/cas-attempt-result.interface.ts`** (full content):

```ts
/**
 * Outcome of ONE CAS reservation attempt inside the `getNextId()` loop
 * (TODO-04 §1.3). Parameter/result object keeping service methods within the
 * 2-params rule.
 *
 * AI-agent guidance: `reservedId` is `null` ONLY after a retriable CAS
 * conflict (the loop continues); every other failure throws a domain error
 * instead of returning. `observedCurrent` is the value this attempt read via
 * `GET /numerator`; it feeds the exhausted-retries error context (G8).
 */
export interface CasAttemptResult {
  reservedId: number | null;
  observedCurrent: number;
}
```

**3.5 Create `src/numerator/interfaces/cas-failure-context.interface.ts`** (full content):

```ts
/**
 * Parameter object for classifying and handling a failed test-and-set call
 * (keeps `NumeratorService.handleTestAndSetFailure` within the 2-params rule).
 */
export interface CasFailureContext {
  error: unknown;
  attempt: number;
  maxRetries: number;
  currentNumerator: number;
  candidate: number;
}
```

**3.6 Verify:** run `npm run build` → expect exit 0.

**3.7 Commit:**

- `git add src/numerator/numerator.constants.ts src/numerator/errors/numerator.errors.ts src/numerator/interfaces/numerator-api.interfaces.ts src/numerator/interfaces/cas-attempt-result.interface.ts src/numerator/interfaces/cas-failure-context.interface.ts`
- `git commit -m "feat(numerator): add CAS constants, domain errors and wire interfaces"`

### Step 4 — Service + module (Commit C)

**4.1 Create `src/numerator/numerator.service.ts`** (full content — copy verbatim):

```ts
/**
 * Numerator API client (TODO-04 §Task 1).
 *
 * Generates unique sequential IDs through the mock's atomic CAS endpoint
 * (`PUT /numerator/test-and-set`) with a bounded retry loop: every attempt
 * re-reads the current value (`GET /numerator`), proposes `current + 1` and
 * test-and-sets it. ONLY a genuine CAS conflict (HTTP 400 whose body carries
 * a numeric `currentNumerator`) is retried, with a light exponential backoff
 * `min(base * 2^retryIndex, MAX_NUMERATOR_BACKOFF_MS)`; every other failure
 * (network, timeout, 5xx, unexpected 400) surfaces immediately as a domain
 * error so callers can abort before writing anything.
 *
 * AI-agent guidance:
 * - IDs are returned as STRINGS (json-server string-id convention, TODO §1.1).
 * - Config reads go through `ConfigService` + `ConfigKeys` only (never
 *   `process.env`); MAX_RETRIES and NUMERATOR_BASE_BACKOFF_MS are optional
 *   with in-code defaults from `numerator.constants.ts` (global plan G1/G2/G3).
 * - Error taxonomy lives in `errors/numerator.errors.ts`; mapping errors to
 *   HTTP responses is NOT this client's job (global plan G18).
 * - `MAX_RETRIES` counts TOTAL CAS attempts (not extra retries); the backoff
 *   sleep happens only between attempts (the final conflict does not sleep).
 * - Numerator values are non-sensitive numbers — safe to log (G13). Never log
 *   card data anywhere in this client.
 */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ConfigKeys } from '../config/config.keys';
import {
  InvalidNumeratorValueError,
  NumeratorRetriesExhaustedError,
  NumeratorUnavailableError,
} from './errors/numerator.errors';
import { CasAttemptResult } from './interfaces/cas-attempt-result.interface';
import { CasFailureContext } from './interfaces/cas-failure-context.interface';
import {
  CasConflictResponseBody,
  CasSuccessResponseBody,
  NumeratorCurrentResponseBody,
} from './interfaces/numerator-api.interfaces';
import {
  CAS_CONFLICT_STATUS,
  MAX_NUMERATOR_BACKOFF_MS,
  NUMERATOR_DEFAULT_BASE_BACKOFF_MS,
  NUMERATOR_DEFAULT_MAX_RETRIES,
} from './numerator.constants';

@Injectable()
export class NumeratorService {
  private readonly logger = new Logger(NumeratorService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = configService.getOrThrow<string>(ConfigKeys.NumeratorApiUrl);
  }

  async getNextId(): Promise<string> {
    const maxRetries = this.configService.get<number>(
      ConfigKeys.MaxRetries,
      NUMERATOR_DEFAULT_MAX_RETRIES,
    );
    const reservedId = await this.retryReservation(maxRetries);
    return String(reservedId);
  }

  private async retryReservation(maxRetries: number): Promise<number> {
    let lastKnownCurrent: number | undefined;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptResult = await this.attemptReservation(attempt, maxRetries);
      lastKnownCurrent = attemptResult.observedCurrent;
      if (attemptResult.reservedId !== null) {
        return attemptResult.reservedId;
      }
    }
    throw new NumeratorRetriesExhaustedError(maxRetries, lastKnownCurrent);
  }

  private async attemptReservation(attempt: number, maxRetries: number): Promise<CasAttemptResult> {
    const currentNumerator = await this.getCurrentNumerator();
    const candidate = this.buildCandidate(currentNumerator);
    try {
      await this.testAndSet(currentNumerator, candidate);
      return { reservedId: candidate, observedCurrent: currentNumerator };
    } catch (error) {
      return this.handleTestAndSetFailure({ error, attempt, maxRetries, currentNumerator, candidate });
    }
  }

  private async handleTestAndSetFailure(context: CasFailureContext): Promise<CasAttemptResult> {
    if (!this.isCasConflict(context.error)) {
      throw this.toUnavailableError(context.error);
    }
    this.logConflict(context);
    await this.waitForRetry(context.attempt, context.maxRetries);
    return { reservedId: null, observedCurrent: context.currentNumerator };
  }

  private isCasConflict(error: unknown): boolean {
    if (!isAxiosError<CasConflictResponseBody>(error)) {
      return false;
    }
    return this.isConflictResponse(error.response);
  }

  private isConflictResponse(
    response: AxiosResponse<CasConflictResponseBody> | undefined,
  ): boolean {
    const currentNumerator = response?.data?.currentNumerator;
    return response?.status === CAS_CONFLICT_STATUS && typeof currentNumerator === 'number';
  }

  private toUnavailableError(error: unknown): NumeratorUnavailableError {
    if (error instanceof Error) {
      return new NumeratorUnavailableError(error.message);
    }
    return new NumeratorUnavailableError(String(error));
  }

  private logConflict(context: CasFailureContext): void {
    this.logger.warn(
      `Numerator CAS conflict — attempt ${context.attempt}/${context.maxRetries}, current=${context.currentNumerator}, candidate=${context.candidate}`,
    );
  }

  private async waitForRetry(attempt: number, maxRetries: number): Promise<void> {
    if (attempt >= maxRetries) {
      return;
    }
    await this.sleep(this.computeBackoffDelay(attempt));
  }

  private computeBackoffDelay(attempt: number): number {
    const baseBackoffMs = this.configService.get<number>(
      ConfigKeys.NumeratorBaseBackoffMs,
      NUMERATOR_DEFAULT_BASE_BACKOFF_MS,
    );
    const retryIndex = attempt - 1;
    return Math.min(baseBackoffMs * 2 ** retryIndex, MAX_NUMERATOR_BACKOFF_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getCurrentNumerator(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NumeratorCurrentResponseBody>(`${this.baseUrl}/numerator`),
      );
      return this.extractValidCurrent(response.data);
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  private extractValidCurrent(data: NumeratorCurrentResponseBody): number {
    const rawNumerator = data.numerator;
    if (!isFiniteNumber(rawNumerator)) {
      throw new InvalidNumeratorValueError(rawNumerator);
    }
    return rawNumerator;
  }

  private buildCandidate(currentNumerator: number): number {
    const candidate = currentNumerator + 1;
    if (!Number.isSafeInteger(candidate)) {
      throw new InvalidNumeratorValueError(candidate);
    }
    return candidate;
  }

  private async testAndSet(oldValue: number, newValue: number): Promise<void> {
    const casUrl = `${this.baseUrl}/numerator/test-and-set`;
    await firstValueFrom(
      this.httpService.put<CasSuccessResponseBody>(casUrl, { oldValue, newValue }),
    );
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
```

Notes encoded above (do not "improve"):
- `testAndSet(oldValue, newValue)` = exactly 2 params (max-2-params rule satisfied; no param object needed). Base URL is NOT a third param — it comes from the `baseUrl` readonly field.
- `sleep(ms)` = 1 param. `isFiniteNumber` is a module-level helper mirroring `isAuthorizedKey` in `api-key.guard.ts`.
- Multi-section boolean conditions live ONLY inside named predicates (`isConflictResponse`, `isFiniteNumber`) per the single-section-boolean-conditions rule.
- Depth interpretation (decision T1-D2): nesting counted as block-nesting levels within a method body — `for`→`if` in `retryReservation` is exactly 2 levels (allowed); a block INSIDE that `if` would be the forbidden 3rd level. No method here nests deeper.

**4.2 Create `src/numerator/numerator.module.ts`** (full content):

```ts
/**
 * Feature module for the Numerator client (TODO-04 §1.5, decision T1-D1).
 *
 * Imports the BARE `HttpModule` (valid in @nestjs/axios v4: the class itself
 * provides + exports `HttpService` with the default axios instance — no
 * timeout yet). Exports `NumeratorService` so later modules can inject it.
 *
 * AI-agent guidance: the module-registration task (TODO-04 Task 3) upgrades
 * this import to the timeout-configured form (`HttpModule.register` — note
 * `forRoot` does NOT exist in v4) and registers this module in `AppModule`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { NumeratorService } from './numerator.service';

@Module({
  imports: [HttpModule],
  providers: [NumeratorService],
  exports: [NumeratorService],
})
export class NumeratorModule {}
```

**4.3 Verify:** run `npm run build` → expect exit 0. Then run `npm run lint` → expect exit 0; if it auto-fixed any file, run `git status` and include fixed files in this commit.

**4.4 Commit:**

- `git add src/numerator/numerator.service.ts src/numerator/numerator.module.ts`
- `git commit -m "feat(numerator): implement NumeratorService getNextId with CAS retry loop"`

### Step 5 — Structure map (Commit D)

**5.1 Edit `.agent/project-structure.md`:** after the `src/transactions/` line, insert EXACTLY:

```text
- src/numerator/ - Numerator API client (TODO-04 Task 1): NumeratorService CAS retry loop (getNextId), NumeratorModule, tuning constants, domain errors (errors/) and wire interfaces (interfaces/)
```

(Do not modify any other line. `src/json-server/` is added by Task 3 per G15.)

**5.2 Commit:**

- `git add .agent/project-structure.md`
- `git commit -m "chore(structure): map src/numerator in project-structure"`

### Step 6 — Final acceptance verification (read-only)

1. `npm run build` → exit 0.
2. `npm run lint` → exit 0.
3. `git status` → clean (only the two untracked TODO files remain).
4. `git log --oneline -10` → the 4 commits of this plan on top.
5. Walk the acceptance checklist below; report any miss to the caller instead of fixing scope silently.

---

## 4) Acceptance Checklist

| # | Requirement (source) | Verified by |
|---|---|---|
| 1 | `getNextId(): Promise<string>` returning `String(candidate)` (§1.1, G9) | service snippet; build |
| 2 | Uses atomic `PUT /numerator/test-and-set` with `{ oldValue, newValue }` (§1.1/§1.2) | `testAndSet` |
| 3 | Loop up to MAX_RETRIES: GET → candidate=current+1 → CAS → success returns / conflict retries / exhausted throws (§1.3, G6) | `retryReservation` |
| 4 | Current value validated as finite number; candidate re-checked `Number.isSafeInteger`; violation → immediate `InvalidNumeratorValueError` (§1.3 step 2, §1.4, G7) | `extractValidCurrent`, `buildCandidate` |
| 5 | Conflict = axios 400 + numeric `currentNumerator` ONLY; all else fails fast wrapped as `NumeratorUnavailableError` (G5) | `isCasConflict`, `isConflictResponse`, `toUnavailableError` |
| 6 | Network/timeout/5xx → clear custom domain error (§1.4, G8) | `toUnavailableError` |
| 7 | Exhausted retries → `NumeratorRetriesExhaustedError` carrying maxRetries + last known current (§1.4, G8) | `retryReservation` |
| 8 | Backoff default 20 ms, light exponential `min(base*2^retryIndex, 160)` (§1.3, G4) | `computeBackoffDelay`, constants |
| 9 | `MAX_RETRIES` optional env var, default 10, validated `@IsOptional() @Type(() => Number) @IsInt() @Min(1)` (§1.3, G1) | env.validation.ts edit |
| 10 | `NUMERATOR_BASE_BACKOFF_MS` optional env var, default 20, same pattern (G2) | env.validation.ts edit |
| 11 | `ConfigKeys.MaxRetries` + `ConfigKeys.NumeratorBaseBackoffMs` added (G1/G2) | config.keys.ts edit |
| 12 | `.env.example` documents both as optional with defaults; local `.env` untouched and still boots (G3) | .env.example edit |
| 13 | Base URL from `NUMERATOR_API_URL` via `ConfigService.getOrThrow(ConfigKeys.NumeratorApiUrl)`; no `process.env` (§1.5, "Configuration & resilience") | constructor |
| 14 | `HttpService` + `ConfigService` injected (§1.5) | constructor |
| 15 | Low-level calls as private methods `getCurrentNumerator()` / `testAndSet(oldValue, newValue)` (§1.5, TODO §1.5) | service |
| 16 | Dedicated `NumeratorModule` + `NumeratorService` (§1.5, T1-D1) | module file |
| 17 | Conflict logging with attempt, current, candidate; no sensitive data logged ("Configuration & resilience", G13) | `logConflict` |
| 18 | No other HTTP library; no timeout literal in this task (Task 3 owns it) | imports; module file |
| 19 | Rules: ≤200 lines/file, ≤50-line methods, ≤2 params (param objects in `interfaces/`), ≤2 nesting depth, private-by-default, no commented-out code, self-documenting (rules) | code review |
| 20 | `npm run build` + `npm run lint` exit 0 (G16); no tests written | Step 6 |
| 21 | 4 commits with exact messages; TODO files and `.env` never staged (G19, gitignore rule) | git log / git status |

---

## 5) Known Deviations & Decisions

| ID | Decision / deviation | Rationale |
|---|---|---|
| T1-D1 | Minimal `NumeratorModule` importing bare `HttpModule` created in Task 1; timeout config + `AppModule` registration deferred to Task 3 | TODO §1.5 mandates "dedicated NestJS module + service" existing at end of Task 1; keeps tasks independently reviewable (matches global plan) |
| T1-D2 | Depth rule interpretation: block-nesting levels counted within method body; `for`→`if` = 2 levels (allowed), a 3rd nested block would be extracted | Matches the rule's "3rd level of nesting → extract" wording and keeps the TODO §1.3 pseudocode shape literal |
| T1-D3 | **Deviation from G15**: Task 1 updates `.agent/project-structure.md` for `src/numerator/` (Task 3 still adds `src/json-server/`) | Project Structure Rule requires the map to accurately reflect the structure at the END of each task; leaving it stale between Tasks 1 and 3 would violate it |
| T1-D4 | `isAxiosError` used as standalone named import (not `AxiosError.isAxiosError`) | Verified against installed axios 1.20.0 typings (research finding 3) |
| T1-D5 | Defaults (10 / 20 / 160) live ONLY in `numerator.constants.ts`; env fields carry no initializers | Single source of truth; `get(key, DEFAULT)` reads mirror `SWAGGER_ENABLED` style |
| T1-D6 | G18 drift accepted: TODO governs (10 retries / 20 ms / error classes, no 503 mapping). The step-4.4 docs pass of THIS task should reconcile `architecture.md` "Concurrency Strategy" numbers (5→10, 50ms→20ms, 503→domain errors) — flagged here for the caller | TODO is the spec of record |
| T1-D7 | Task 3 input finding: `HttpModule.forRoot` does not exist in @nestjs/axios v4 — G12 must be implemented as `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` | Verified in `dist/http.module.d.ts` (research finding 2) |
| T1-D8 | strictNullChecks-safe narrowing (plan-correction cycle): `isFiniteNumber` is a **type predicate** (`value is number`, semantics unchanged) and `isConflictResponse` narrows via a local `const currentNumerator = response?.data?.currentNumerator` binding before the status check — G5 discriminator semantics (400 + numeric `currentNumerator`) unchanged | `response?.status === X` does not narrow `response` (would fail `npm run build` under `strictNullChecks: true`); a `boolean` helper over `unknown` provides no narrowing (`unknown` not assignable to `number`). Found by caller review of §4.1 |

---

Original task re-verification: compare plan vs TODO §Task 1 — **ADHERENT**. Every §1.1–§1.5 item and both applicable "Configuration & resilience" bullets map to a checklist row (§4); out-of-scope items (Task 2, Task 3 wiring, tests, docker, docs authoring) are excluded; deviations are the explicitly listed T1-D1…T1-D8, all of which strengthen (never weaken) TODO compliance.
