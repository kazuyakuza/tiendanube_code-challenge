# Implementation Plan — Task 2: json-server Client (TODO-04)

- **TODO file**: `.agent/todos/20260913/20260913-todo-4.md` — **Task 2 ONLY** (§2.1–§2.4 + the cross-cutting "Configuration & resilience" bullets applicable here: ConfigService-only config, no sensitive card data in logs)
- **Branch**: `feat/external-clients` (already created in workflow step 2 — do NOT create/switch branches)
- **Version**: already bumped to `0.3.0` in step 3 — do NOT touch `package.json`
- **Global plan**: `.kilo/plans/20260913-external-clients.md` (decisions G8, G10, G11, G12/G14, G13, G16, G19 binding here)
- **Front-end related**: NO (4.1a/4.5a omitted). **Tests**: NONE (TODO explicit out of scope).
- **Executor**: JUNIOR developer under 50% restriction — every structural decision is encoded below; do not deviate, do not expand scope. If anything is ambiguous, STOP and ask the caller.

---

## 0) Scope & Out of Scope

### In scope (exactly this — smallest clean Task-2 file set; Task 3 finishes the wiring)

| Artifact | Purpose |
|---|---|
| `src/json-server/interfaces/create-transaction-payload.interface.ts` | `CreateTransactionPayload` transport type (G10) |
| `src/json-server/interfaces/create-receivable-payload.interface.ts` | `CreateReceivablePayload` transport type (G10) |
| `src/json-server/interfaces/json-server-error-context.interface.ts` | Param object keeping `toRequestError` within the 2-params rule |
| `src/json-server/interfaces/json-server-request-failure.interface.ts` | Param object for the domain-error constructor (2-params rule) |
| `src/json-server/errors/json-server.errors.ts` | `JsonServerRequestError` — resource + status + message (G8) |
| `src/json-server/json-server.constants.ts` | Resource path constants ONLY (`transactions` / `receivables`) — NO timeout here (G12 is Task 3) |
| `src/json-server/json-server.service.ts` | `createTransaction` / `createReceivable`, fail-fast POSTs (§2.1–§2.3) |
| `src/json-server/json-server.module.ts` | Minimal `@Module` (T1-D1 precedent mirrored) |
| `.agent/project-structure.md` | Add `src/json-server/` line (T1-D3 precedent) |

### Out of scope — do NOT touch

- `src/app.module.ts`, `HttpModule.register({ timeout })` and the HTTP timeout constant file `src/common/constants/http-timeout.constants.ts` (all **Task 3** per G12/G14 and T1-D7 — Task 3 must use `HttpModule.register`, there is NO `forRoot` in `@nestjs/axios` v4).
- Orchestration/service layer, controllers, fee calculation, card-number masking on the write path, json-server retry policy (fail-fast only, TODO §Out of scope), unit/e2e tests, docker commands, `README.md`/`docs/` authoring (step 4.4 owns docs), local `.env` (user-owned, gitignored — NEVER edit), `.agent/todos/20260913/*.md` (untracked user files — NEVER stage/commit), `package.json`.
- **Config files** (`src/config/env.validation.ts`, `src/config/config.keys.ts`, `.env.example`): `JSON_SERVER_URL` is ALREADY a required, validated env var with an existing `ConfigKeys` entry — research finding 5. Do NOT modify any config file (caller instruction). The stale "only key still without a consumer" JSDoc consumption-map text is flagged, not edited (decision T2-D12).

---

## 1) Research Findings (evidence)

1. **`@nestjs/axios` 4.0.1** (`node_modules/@nestjs/axios/dist/http.service.d.ts:10`): `post<T = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Observable<AxiosResponse<T, D>>` — first generic types the response body, second types the request body. Convert with `firstValueFrom` from `rxjs` (7.8.2 installed; T1 precedent in `src/numerator/numerator.service.ts`).
2. **`HttpModule` in v4 has NO `forRoot`** — only `static register(config)` / `registerAsync` (`dist/http.module.d.ts:3–7`). Bare `imports: [HttpModule]` IS valid: the class itself is decorated with providers + exports for `HttpService` (verified in Task 1 research; the committed `src/numerator/numerator.module.ts` compiles with exactly this form). → The minimal Task-2 module mirrors it; Task 3 upgrades to `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (T1-D7).
3. **`axios` 1.20.0**: `isAxiosError` is a standalone named export (`node_modules/axios/index.d.ts:749–751`, `payload is AxiosError<T, D, P>`); `AxiosError.response?: AxiosResponse` is OPTIONAL (`index.d.ts:536`) → network/timeout/DNS failures reject with an `AxiosError` that has NO `response`, so the HTTP status is `undefined` for them. Non-2xx responses reject with `error.response.status` set. No retries anywhere in this client (TODO §Out of scope).
4. **json-server contract**: `docker-compose.yml:3–11` — image `vimagick/json-server`, serving `/config/db.json` on port 8080. `config/db.json:2–62` — resources are exactly `transactions` and `receivables`; stored field shapes match TODO §2.4 verbatim (string ids, string amounts, masked 4-digit `cardNumber`, snake_case receivable fields `transaction_id`/`create_date`). json-server answers a successful collection POST with **201** echoing the created object; error bodies are not a stable contract → the client must NOT depend on `error.response.data` content (decision T2-D7). Do NOT run docker; no live verification in this task (G16).
5. **Config already plumbed — reuse, no edits**: `JSON_SERVER_URL` is required + validated (`src/config/env.validation.ts:72–73`, `@IsUrl(urlValidationOptions)` — protocol required, plan addendum A4-R) and `ConfigKeys.JsonServerUrl = 'JSON_SERVER_URL'` exists (`src/config/config.keys.ts:28`). `.env.example` already documents it. → Task 2 adds zero config plumbing; the service reads it via `getOrThrow`.
6. **Dedicated payload interfaces are mandatory (G10), DTO reuse rejected — evidence**: `CreateTransactionDto` (`src/transactions/dto/create-transaction.dto.ts:53–59`) carries the FULL card number (`@Matches(/^\d{13,19}$/)`) and has NO `id` field, while the transport payload requires `id` (from Numerator) and the ALREADY-MASKED last-4 `cardNumber` (TODO §2.4). Reusing the DTO would encode the wrong card semantics and force a fake `id`. The receivable payload has no request DTO at all. → G10 dedicated interfaces stand.
7. **Enum members match the seed data** (payload typing is correct): `PaymentMethod.DEBIT_CARD = 'debit_card'` / `CREDIT_CARD = 'credit_card'` (`src/common/enums/payment-method.enum.ts:14–17`) vs `config/db.json:7,17,27`; `ReceivableStatus.PAID = 'paid'` / `WAITING_FUNDS = 'waiting_funds'` (`src/common/enums/receivable-status.enum.ts:13–16`) vs `config/db.json:37,47,56`.
8. **Response DTOs fit G11 type-only import**: `TransactionResponseDto` (`src/transactions/dto/transaction-response.dto.ts:18–66`) and `ReceivableResponseDto` (`src/transactions/dto/receivable-response.dto.ts:20–62`) field sets are structurally identical to the §2.4 payloads; the runtime body is json-server's echo, so the service imports them TYPE-ONLY — no runtime module dependency on `src/transactions`.
9. **House style to mirror exactly**: `src/numerator/numerator.service.ts` (constructor `getOrThrow` base URL, `private readonly` members, `firstValueFrom` usage, module-level pure helper at file bottom), `src/numerator/numerator.module.ts` (minimal `@Module` + file-header JSDoc explaining imports/exports + Task-3 pointer), `src/numerator/errors/numerator.errors.ts` (error-class JSDoc taxonomy header, `this.name` assignment, `readonly` carried fields), `src/numerator/numerator.constants.ts` (JSDoc header with AI-agent guidance block), `src/numerator/interfaces/*` (per-interface JSDoc, param-object files).
10. **tsconfig/eslint**: `strictNullChecks: true` (narrow `error.response?.status` via optional chaining — it yields `number | undefined` naturally); no `verbatimModuleSyntax` (`import type` compiles fine and is elided); `tseslint.configs.recommended` → no `any`, no unused vars. `npm run lint` auto-fixes (`--fix`) — re-check `git status` after lint.
11. **Rules binding the code** (`.kilo/rules/`): ≤200 lines/file, ≤50-line method bodies, ≤2 params (else typed param object in a new file), ≤2 nesting depth, private-by-default members, single-section boolean conditions, no commented-out code, self-documenting names, no magic strings (resource path segments as named constants).

---

## 2) Files to Create / Modify

| # | File | Action | Commit |
|---|---|---|---|
| 1 | `src/json-server/interfaces/create-transaction-payload.interface.ts` | create | A |
| 2 | `src/json-server/interfaces/create-receivable-payload.interface.ts` | create | A |
| 3 | `src/json-server/interfaces/json-server-error-context.interface.ts` | create | A |
| 4 | `src/json-server/interfaces/json-server-request-failure.interface.ts` | create | A |
| 5 | `src/json-server/errors/json-server.errors.ts` | create | A |
| 6 | `src/json-server/json-server.constants.ts` | create | B |
| 7 | `src/json-server/json-server.service.ts` | create | B |
| 8 | `src/json-server/json-server.module.ts` | create | B |
| 9 | `.agent/project-structure.md` | modify (add `src/json-server/` line) | C |

---

## 3) Steps (execute in order; single commands only — Windows PowerShell shell)

> General discipline for EVERY step: before each commit run `git status` and verify (a) you are on `feat/external-clients`, (b) only the files listed for that commit are staged, (c) `.agent/todos/20260913/*.md`, `.env`, and the pre-existing user edit `M package.json` (docker-script rename) are NEVER staged and NEVER reverted. If `npm run lint` auto-fixed files, add them to the currently pending commit.

### Step 1 — Preflight (read-only)

1. Run: `git status` → expect: branch `feat/external-clients`; `M package.json` (pre-existing user edit — leave untouched); untracked `.agent/todos/20260913/20260913-todo-4.md` and `20260913-todo-5.md`. If anything else is dirty, STOP and report to caller.
2. Run: `git branch --show-current` → expect `feat/external-clients`.
3. Read `.gitignore` (gitignore-compliance rule). Confirm `.env` is ignored; `package.json` is tracked — its modification stays unstaged.

### Step 2 — Payload interfaces, error context/failure objects, domain error (Commit A)

**2.1 Create `src/json-server/interfaces/create-transaction-payload.interface.ts`** (full content — copy verbatim):

```ts
/**
 * Transport payload for `POST {JSON_SERVER_URL}/transactions` (TODO-04 §2.4,
 * global plan G10). Transport-only: the json-server client does NOT calculate
 * fees, mask card numbers, generate ids, or default any field — the caller
 * supplies every value verbatim, including the Numerator-generated `id` and
 * the ALREADY-MASKED last-4 `cardNumber`.
 *
 * AI-agent guidance: deliberately NOT reused from `CreateTransactionDto` —
 * that request DTO carries the full 13–19-digit PAN and has no `id` field
 * (TODO-03 contract), which is the wrong shape for this wire payload.
 * `method` uses the shared `PaymentMethod` enum type (wire values
 * `debit_card` / `credit_card`, matching the json-server seed `config/db.json`).
 */
import type { PaymentMethod } from '../../common/enums/payment-method.enum';

export interface CreateTransactionPayload {
  /** Unique id generated via the Numerator API (string per json-server convention). */
  id: string;
  /** Transaction amount as a string (json-server stores string amounts). */
  value: string;
  /** Purchase description as received. */
  description: string;
  /** Payment method; decides the receivable status upstream, not here. */
  method: PaymentMethod;
  /** Already-masked card number (last 4 digits) — masking is NOT this client's job. */
  cardNumber: string;
  /** Cardholder name as received. */
  cardHolderName: string;
  /** Card expiration date in MM/YY format as received. */
  cardExpirationDate: string;
  /** Card verification code as received. */
  cardCvv: string;
}
```

**2.2 Create `src/json-server/interfaces/create-receivable-payload.interface.ts`** (full content):

```ts
/**
 * Transport payload for `POST {JSON_SERVER_URL}/receivables` (TODO-04 §2.4,
 * global plan G10). Transport-only: every field — including `create_date` —
 * is supplied by the caller verbatim; this client computes nothing (no fee
 * math, no status mapping, no dates).
 *
 * AI-agent guidance: field names keep the json-server wire format
 * (`transaction_id`, `create_date` — snake_case, matching `config/db.json`).
 * `create_date` is a caller-supplied string (ISO-8601 recommended per TODO
 * §2.4; the seed's DD/MM/YYYY format is a known discrepancy owned by the
 * business layer, NOT by this client). `status` uses the shared
 * `ReceivableStatus` enum type (wire values `paid` / `waiting_funds`).
 */
import type { ReceivableStatus } from '../../common/enums/receivable-status.enum';

export interface CreateReceivablePayload {
  /** Unique id generated via the Numerator API (string per json-server convention). */
  id: string;
  /** Id of the originating transaction (also Numerator-generated). */
  transaction_id: string;
  /** `paid` for debit_card (D+0) / `waiting_funds` for credit_card — mapped upstream, not here. */
  status: ReceivableStatus;
  /** Caller-supplied creation date string (ISO-8601 recommended). */
  create_date: string;
  /** Same value as the originating transaction, as a string. */
  subtotal: string;
  /** Fee percentage as a string ("2" debit / "4" credit) — computed upstream, not here. */
  discount: string;
  /** Net amount as a string — computed upstream, not here. */
  total: string;
}
```

**2.3 Create `src/json-server/interfaces/json-server-error-context.interface.ts`** (full content):

```ts
/**
 * Parameter object for classifying a failed json-server POST inside
 * `JsonServerService` (keeps `toRequestError` within the 2-params rule).
 *
 * AI-agent guidance: `error` is the raw caught value (`unknown` on purpose —
 * axios rejections are `AxiosError`, but anything can be thrown); the service
 * narrows it with `isAxiosError` before reading a status.
 */
export interface JsonServerErrorContext {
  /** json-server resource path the failed call targeted (e.g. `transactions`). */
  resource: string;
  /** Raw caught error from the HTTP call. */
  error: unknown;
}
```

**2.4 Create `src/json-server/interfaces/json-server-request-failure.interface.ts`** (full content):

```ts
/**
 * Parameter object for constructing `JsonServerRequestError` (keeps the
 * constructor within the 2-params rule) and for the failure log line.
 *
 * AI-agent guidance: `status` is `number | undefined` EXPLICITLY (not an
 * optional `?` property) so callers must always pass the key — `undefined`
 * means "no HTTP status existed" (network/timeout/non-axios failure).
 * `reason` is axios-generated text (e.g. "Request failed with status code
 * 400"); it must NEVER be taken from the upstream response body, which could
 * echo card data (TODO §Configuration & resilience).
 */
export interface JsonServerRequestFailure {
  /** json-server resource path the failed call targeted. */
  resource: string;
  /** HTTP status when one exists; `undefined` for network/timeout/non-axios failures. */
  status: number | undefined;
  /** Safe, payload-free failure reason (axios-generated text). */
  reason: string;
}
```

**2.5 Create `src/json-server/errors/json-server.errors.ts`** (full content):

```ts
/**
 * Domain error class for the json-server client (TODO-04 §2.3, global plan G8).
 *
 * `JsonServerRequestError` — a POST to a json-server resource failed: 4xx/5xx
 * response, network/timeout failure, or any non-axios error. Carries the
 * resource path, the HTTP status when one exists (`undefined` otherwise) and
 * a payload-free reason, so the orchestration layer can decide what to do
 * (fail-fast — this client never retries, TODO §Out of scope).
 *
 * AI-agent guidance: mapping this error to HTTP responses is the orchestration
 * layer's job, NOT this client's (global plan G18) — no status codes are
 * thrown from here. The message is built ONLY from resource + status +
 * axios-generated reason text; upstream response bodies are never
 * interpolated (card-data privacy, TODO §Configuration & resilience).
 */
import type { JsonServerRequestFailure } from '../interfaces/json-server-request-failure.interface';

export class JsonServerRequestError extends Error {
  readonly resource: string;
  readonly status: number | undefined;

  constructor(failure: JsonServerRequestFailure) {
    super(buildRequestErrorMessage(failure));
    this.name = 'JsonServerRequestError';
    this.resource = failure.resource;
    this.status = failure.status;
  }
}

function buildRequestErrorMessage(failure: JsonServerRequestFailure): string {
  return `json-server request failed — resource=${failure.resource}, status=${failure.status ?? 'unknown'}, reason=${failure.reason}`;
}
```

**2.6 Verify:** run `npm run build` → expect exit 0.

**2.7 Commit:**

- `git add src/json-server/interfaces/create-transaction-payload.interface.ts src/json-server/interfaces/create-receivable-payload.interface.ts src/json-server/interfaces/json-server-error-context.interface.ts src/json-server/interfaces/json-server-request-failure.interface.ts src/json-server/errors/json-server.errors.ts`
- `git commit -m "feat(json-server): add transport payload interfaces and domain error"`

### Step 3 — Constants, service, module (Commit B)

**3.1 Create `src/json-server/json-server.constants.ts`** (full content):

```ts
/**
 * json-server client resource-path constants (TODO-04 §2.2).
 *
 * The two collection names the client POSTs to, kept as named constants per
 * the avoid-magic-strings rule. NO timeout constant lives here — the HTTP
 * timeout belongs to the module-registration task (TODO-04 Task 3, global
 * plan G12; `HttpModule.register`, decision T1-D7).
 *
 * AI-agent guidance: do not inline these path segments in the service; import
 * them from this file so a resource rename is a one-line change.
 */

/** json-server collection for created transactions. */
export const TRANSACTIONS_RESOURCE_PATH = 'transactions';

/** json-server collection for created receivables. */
export const RECEIVABLES_RESOURCE_PATH = 'receivables';
```

**3.2 Create `src/json-server/json-server.service.ts`** (full content — copy verbatim):

```ts
/**
 * json-server persistence client (TODO-04 §Task 2). Upstream: the provided
 * json-server container serving `config/db.json` on port 8080
 * (`docker-compose.yml`); runbook: `docs/app-setup.md` (External clients).
 *
 * Transport-only: POSTs caller-built payloads to the `transactions` and
 * `receivables` collections and returns the echoed resource body. This client
 * does NOT calculate fees, mask card numbers, generate ids, or default any
 * field — the caller supplies ids (from Numerator) and every payload field
 * verbatim (TODO §2.4). Fail-fast: any 4xx/5xx, network or timeout failure is
 * wrapped as `JsonServerRequestError` (resource + status + reason) with NO
 * retries — the retry policy is explicitly out of scope (TODO §Out of scope).
 *
 * AI-agent guidance:
 * - Base URL comes from `ConfigService.getOrThrow(ConfigKeys.JsonServerUrl)`
 *   (env `JSON_SERVER_URL`, validated at bootstrap); never `process.env`.
 * - Trailing slashes in the configured base URL are stripped once at
 *   construction so resource URLs never double-slash (decision T2-D1).
 * - NEVER log request payloads: they carry card data (TODO §Configuration &
 *   resilience). The only log line is a failure warning with resource + HTTP
 *   status; the error reason is axios-generated text, never the upstream body.
 * - Success = any resolved response (json-server answers 201 on create); the
 *   status is NOT asserted — the echoed body is returned as-is (decision
 *   T2-D3).
 * - Response DTOs are imported TYPE-ONLY (global plan G11): no runtime
 *   dependency on the transactions DTO module exists here.
 * - The module file registers the service minimally; HttpModule timeout
 *   config and AppModule wiring belong to TODO-04 Task 3 (global plan
 *   G12/G14, decision T1-D7: `HttpModule.register`, no `forRoot` in v4).
 */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ConfigKeys } from '../config/config.keys';
import { JsonServerRequestError } from './errors/json-server.errors';
import {
  RECEIVABLES_RESOURCE_PATH,
  TRANSACTIONS_RESOURCE_PATH,
} from './json-server.constants';
import type { JsonServerErrorContext } from './interfaces/json-server-error-context.interface';
import type { CreateTransactionPayload } from './interfaces/create-transaction-payload.interface';
import type { CreateReceivablePayload } from './interfaces/create-receivable-payload.interface';
import type { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import type { ReceivableResponseDto } from '../transactions/dto/receivable-response.dto';

@Injectable()
export class JsonServerService {
  private readonly logger = new Logger(JsonServerService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.normalizeBaseUrl(configService.getOrThrow<string>(ConfigKeys.JsonServerUrl));
  }

  async createTransaction(payload: CreateTransactionPayload): Promise<TransactionResponseDto> {
    return this.postResource<TransactionResponseDto, CreateTransactionPayload>(
      TRANSACTIONS_RESOURCE_PATH,
      payload,
    );
  }

  async createReceivable(payload: CreateReceivablePayload): Promise<ReceivableResponseDto> {
    return this.postResource<ReceivableResponseDto, CreateReceivablePayload>(
      RECEIVABLES_RESOURCE_PATH,
      payload,
    );
  }

  private async postResource<TResponse, TPayload>(
    resourcePath: string,
    payload: TPayload,
  ): Promise<TResponse> {
    const resourceUrl = `${this.baseUrl}/${resourcePath}`;
    try {
      const response = await firstValueFrom(
        this.httpService.post<TResponse, TPayload>(resourceUrl, payload),
      );
      return response.data;
    } catch (error) {
      throw this.toRequestError({ resource: resourcePath, error });
    }
  }

  private toRequestError(context: JsonServerErrorContext): JsonServerRequestError {
    const status = this.extractStatus(context.error);
    this.logger.warn(`json-server ${context.resource} request failed (${describeStatus(status)})`);
    return new JsonServerRequestError({
      resource: context.resource,
      status,
      reason: this.extractReason(context.error),
    });
  }

  private normalizeBaseUrl(rawBaseUrl: string): string {
    return rawBaseUrl.replace(/\/+$/, '');
  }

  private extractStatus(error: unknown): number | undefined {
    if (!isAxiosError(error)) {
      return undefined;
    }
    return error.response?.status;
  }

  private extractReason(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

function describeStatus(status: number | undefined): string {
  return status === undefined ? 'no HTTP status' : `HTTP ${status}`;
}
```

Notes encoded above (do not "improve"):
- `postResource(resourcePath, payload)` = exactly 2 params (max-2-params rule satisfied); base URL is NOT a param — it comes from the `baseUrl` readonly field. Generics `<TResponse, TPayload>` map onto `HttpService.post<T, D>` (research finding 1).
- `toRequestError` takes the `JsonServerErrorContext` param object; `JsonServerRequestError`'s constructor takes the `JsonServerRequestFailure` param object (both 1 param).
- `describeStatus` is a module-level pure helper mirroring `isFiniteNumber` in `numerator.service.ts`.
- Success path has ZERO logging (decision T2-D7); the single warn line carries resource + status only — never the payload, never `error.response.data`.
- Depth: no method nests more than 1 level (`try`→`catch`, `if` returns) — well under the 2-level cap.

**3.3 Create `src/json-server/json-server.module.ts`** (full content):

```ts
/**
 * Feature module for the json-server client (TODO-04 §2.3, T1-D1 precedent).
 *
 * Imports the BARE `HttpModule` (valid in @nestjs/axios v4: the class itself
 * provides + exports `HttpService` with the default axios instance — no
 * timeout yet). Exports `JsonServerService` so later modules can inject it.
 *
 * AI-agent guidance: the module-registration task (TODO-04 Task 3) upgrades
 * this import to the timeout-configured form (`HttpModule.register` — note
 * `forRoot` does NOT exist in v4, decision T1-D7) and registers this module
 * in `AppModule` (global plan G14).
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JsonServerService } from './json-server.service';

@Module({
  imports: [HttpModule],
  providers: [JsonServerService],
  exports: [JsonServerService],
})
export class JsonServerModule {}
```

**3.4 Verify:** run `npm run build` → expect exit 0. Then run `npm run lint` → expect exit 0; if it auto-fixed any file, run `git status` and include fixed files in this commit.

**3.5 Commit:**

- `git add src/json-server/json-server.constants.ts src/json-server/json-server.service.ts src/json-server/json-server.module.ts`
- `git commit -m "feat(json-server): implement JsonServerService with fail-fast resource POSTs"`

### Step 4 — Structure map (Commit C)

**4.1 Edit `.agent/project-structure.md`:** after the `src/numerator/` line, insert EXACTLY:

```text
- src/json-server/ - json-server persistence client (TODO-04 Task 2): JsonServerService (createTransaction/createReceivable POSTs), JsonServerModule, resource-path constants, domain error (errors/) and transport payload interfaces (interfaces/)
```

(Do not modify any other line.)

**4.2 Commit:**

- `git add .agent/project-structure.md`
- `git commit -m "chore(structure): map src/json-server in project-structure"`

### Step 5 — Final acceptance verification (read-only)

1. `npm run build` → exit 0.
2. `npm run lint` → exit 0.
3. `git status` → clean except `M package.json` (pre-existing user edit, untouched) and the two untracked TODO files.
4. `git log --oneline -6` → the 3 commits of this plan on top of the Task 1 commits.
5. Walk the acceptance checklist below; report any miss to the caller instead of fixing scope silently.

---

## 4) Acceptance Checklist

| # | Requirement (source) | Verified by |
|---|---|---|
| 1 | `createTransaction(payload: CreateTransactionPayload): Promise<TransactionResponseDto>` (§2.1) | service snippet; build |
| 2 | `createReceivable(payload: CreateReceivablePayload): Promise<ReceivableResponseDto>` (§2.1) | service snippet; build |
| 3 | `POST {base}/transactions` and `POST {base}/receivables` via `HttpService.post` + `firstValueFrom` (§2.2) | `postResource` |
| 4 | Payload interfaces match TODO §2.4 field-for-field, typed with `PaymentMethod` / `ReceivableStatus` (§2.4, G10) | interface files; research finding 7 |
| 5 | Caller-supplied `id` passed through unchanged; client never generates/defaults ids (§2.2 "id supplied by the caller", §2.4) | payload interfaces; service transports verbatim |
| 6 | Client does NOT calculate fees, mask card numbers, or compute `create_date` — transport-only (§2.4) | interface JSDoc + service (no computation anywhere) |
| 7 | On success return the echoed body as `response.data` (§2.3, G11); no status assertion — 201 not special-cased (T2-D3) | `postResource` |
| 8 | Response DTOs imported TYPE-ONLY, no runtime module dependency (G11) | `import type` lines in service |
| 9 | 4xx/5xx → `JsonServerRequestError` carrying resource + status + reason, fail-fast, NO retries (§2.3, G8) | `toRequestError`, errors file |
| 10 | Network/timeout (no `response`) and non-axios errors wrapped too, with `status: undefined` (finding 3, T2-D4) | `extractStatus` |
| 11 | Error message carries resource + status + reason WITHOUT echoing card data — reason is axios-generated text, never `error.response.data` (§2.3 + resilience bullet) | `buildRequestErrorMessage`, T2-D7 |
| 12 | Base URL from `JSON_SERVER_URL` via `ConfigService.getOrThrow(ConfigKeys.JsonServerUrl)`; no `process.env`; NO config-file edits (resilience bullet, research finding 5) | constructor |
| 13 | `HttpService` + `ConfigService` injected (§2.3) | constructor |
| 14 | Dedicated `JsonServerModule` + `JsonServerService`; module provides + exports the service (§2.3, T1-D1 precedent) | module file |
| 15 | No timeout config in this task — Task 3 owns `HttpModule.register({ timeout })` + `AppModule` wiring (G12/G14, T1-D7) | module file has bare `HttpModule` |
| 16 | Logging: zero success logging; one warn on failure with resource + status only; never request bodies (resilience bullet, G13) | `toRequestError` |
| 17 | Resource paths as named constants (no magic strings); no 201 constant anywhere (T2-D5) | constants file |
| 18 | Trailing-slash base URLs normalized once at construction (T2-D1) | `normalizeBaseUrl` |
| 19 | Rules: ≤200 lines/file, ≤50-line methods, ≤2 params (param objects in `interfaces/`), ≤2 nesting depth, private-by-default members, no commented-out code, self-documenting (rules) | code review |
| 20 | `npm run build` + `npm run lint` exit 0 (G16); no tests written | Step 5 |
| 21 | 3 commits with exact messages; `package.json` edit, TODO files and `.env` never staged (G19, gitignore rule) | git log / git status |

---

## 5) Decisions & Deviations

| ID | Decision / deviation | Rationale |
|---|---|---|
| T2-D1 | (a) Trailing-slash handling: strip ALL trailing slashes once in the constructor via `rawBaseUrl.replace(/\/+$/, '')` (private `normalizeBaseUrl`) | `@IsUrl` does not reject trailing slashes; `http://localhost:8080/` would otherwise produce `//transactions` and 404 on json-server. Chosen over "document the requirement" because it removes a whole failure class at zero cost |
| T2-D2 | (b) Dedicated G10 payload interfaces; `CreateTransactionDto` reuse REJECTED | DTO carries the full 13–19-digit PAN and no `id` (create-transaction.dto.ts:53–59) — wrong transport shape (TODO §2.4 wants `id` + already-masked card). Receivable payload has no request DTO at all. G10 followed with loud justification |
| T2-D3 | (c) 201 handling: NO status assertion — success = any resolved axios response; return `response.data` | axios already rejects non-2xx; asserting 201 adds a failure mode json-server's echo behavior doesn't require. TODO §2.3 says "return the body that json-server responds with" |
| T2-D4 | (d) Non-axios errors wrapped as `JsonServerRequestError` with `status: undefined`; error field shape fixed as `readonly resource: string` + `readonly status: number | undefined` + inherited `message` | One error class for every failure mode keeps the orchestration layer's mapping simple (G8); `number | undefined` (not optional `?`) forces callers to pass the key explicitly |
| T2-D5 | (e) No 201 constant; `json-server.constants.ts` holds ONLY the two resource paths | 201 is never referenced in code (T2-D3); the timeout constant belongs to Task 3's file (G12) — keeping it out prevents scope creep |
| T2-D6 | (f) `create_date` is a REQUIRED caller-supplied `string` (ISO-8601 recommended per TODO §2.4); the client computes nothing | TODO §2.4 "it only transports the data it receives"; seed's DD/MM/YYYY discrepancy is documented in the interface JSDoc as upstream-owned, not client-owned |
| T2-D7 | (g) Logging: zero success logging; single `warn` on failure with resource + status only; `reason` = axios `error.message` (or `String(error)`), NEVER `error.response.data` | Upstream error bodies are not a stable contract and could echo payload content — using only axios-generated text makes card-data leakage structurally impossible (TODO resilience bullet + G13) |
| T2-D8 | (h) Naming: folder `src/json-server/`, files `json-server.service.ts` / `json-server.module.ts` / `json-server.constants.ts`, `errors/json-server.errors.ts`, `interfaces/*.interface.ts` | Mirrors the TODO §Task 3 suggested tree and the committed `src/numerator/` house layout exactly |
| T2-D9 | (i) All type-only imports use explicit `import type` (response DTOs per G11, `PaymentMethod` / `ReceivableStatus` in payload interfaces, param-object interfaces in the service) | G11 mandates type-only for the DTOs; extending it to enums/interfaces keeps the transport layer free of runtime dependencies and self-documents intent. Minor style deviation from T1's plain interface imports — justified, no behavior change |
| T2-D10 | (j) NO `src/json-server/dto/` folder — `interfaces/` per G10 | G10 is explicit; `dto/` in this project means class-validator/Swagger classes, which these transport types are not |
| T2-D11 | Two param-object interface files beyond the caller's minimal file set (`JsonServerErrorContext`, `JsonServerRequestFailure`) | Max-2-params rule: the error constructor needs resource+status+reason and `toRequestError` needs resource+error — both exceed 2 flat params; T1 precedent (CasFailureContext) puts typed param objects in `interfaces/` |
| T2-D12 | NO config-file edits; the stale "JsonServerUrl … the only key still without a consumer" JSDoc consumption-map text in `env.validation.ts` / `config.keys.ts` is NOT touched here | Caller instruction: do NOT modify config files unless a key is missing — the key exists and is validated. The JSDoc staleness is flagged for the step-4.4 docs pass of this task (comment-only sweep), not silently edited |
| T2-D13 | Minimal `JsonServerModule` (bare `HttpModule`) created in Task 2; timeout config + `AppModule` registration deferred to Task 3 | T1-D1 precedent mirrored verbatim; TODO §2.3 mandates "dedicated module + service" existing at end of Task 2 while Task 3 owns registration/timeout (G12/G14) |

---

Original task re-verification: compare plan vs TODO §Task 2 — **ADHERENT**. Every §2.1–§2.4 item and the applicable "Configuration & resilience" bullets (ConfigService-only config; no sensitive card data in logs) map to a checklist row (§4); out-of-scope items (Task 3 wiring, orchestration, fees, masking, retries, tests, docker, docs authoring) are excluded; deviations are the explicitly listed T2-D1…T2-D13, all of which strengthen (never weaken) TODO compliance.
