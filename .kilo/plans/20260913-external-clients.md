# Global Plan — External Clients (Numerator API + json-server)

- **TODO file**: `.agent/todos/20260913/20260913-todo-4.md` (internal title "TODO 03 – External Clients"; file number 4 is the workflow handle)
- **Branch**: `feat/external-clients` (created in step 2)
- **Version bump (step 3)**: `0.2.0` → `0.3.0` (minor — new feature layer)
- **Front-end related**: NO for all tasks → sub-steps 4.1a / 4.5a are **omitted**; each task runs 4.1b → 4.2 → 4.3 → 4.4 → 4.5b → 4.6
- **Auto-approve**: the request does **not** contain "Don't request me to approve plans" → global plan and per-task plans require explicit user approval (per-task approval mode chosen below)

## Task parsing decision

The TODO file uses `## Task N.` headings, which no standard pattern (A/B/C) matches exactly.
Decision: the three explicitly numbered headings are the tasks:

1. **Task 1 — Numerator Client** (`getNextId()` + CAS retry)
2. **Task 2 — json-server Client** (`createTransaction` / `createReceivable`)
3. **Task 3 — Module registration** (proper NestJS modules, `HttpModule` timeout, exports, `AppModule` wiring)

`## Goal`, `## Context`, `## Configuration & resilience`, `## Out of scope for this TODO`,
`## Implementation guidance` are cross-cutting context applying to all three tasks — not tasks.

## Global pre-analysis

### Hard constraints (from TODO + rules; binding for every task)

- HTTP only via `@nestjs/axios` `HttpService` — **no other HTTP library**, no `fetch`.
- No `process.env` reads — always `ConfigService` + `ConfigKeys` (`src/config/config.keys.ts` JSDoc rule).
- Reuse TODO-03 artifacts: `PaymentMethod`, `ReceivableStatus`, `TransactionResponseDto`, `ReceivableResponseDto`, `CreateTransactionResponseDto`.
- Out of scope (do NOT touch): orchestration logic, fee calculation, card masking on the write path, controllers, json-server call retries, unit/e2e tests.
- Project rules: ≤200 lines/file, ≤50-line methods, ≤2 params (else typed param object in a new file), ≤2 nesting depth, private-by-default members, no commented-out code, self-documenting names.
- Do not run docker commands; if external services are needed for verification, ask the user. (Planned verification needs no live services — build + lint only.)
- `.env` is gitignored and user-owned: never edit or commit it; update `.env.example` instead.

### Global technical & architecture decisions (encoded so architect/implementer never guess)

| # | Decision | Value / rule |
|---|----------|--------------|
| G1 | New env var for retry count | `MAX_RETRIES` — name fixed by TODO §1.3; **optional**, default `10`; `class-validator` schema: `@Type(() => Number) @IsInt() @Min(1) @IsOptional()` added to `src/config/env.validation.ts` + `ConfigKeys.MaxRetries` + `.env.example` entry |
| G2 | Backoff configurability | TODO lists "Backoff: default 20ms" under *Config .env vars* without naming it. Decision: `NUMERATOR_BASE_BACKOFF_MS` — **optional**, default `20`, same coercion pattern as G1 + `ConfigKeys.NumeratorBaseBackoffMs` + `.env.example` |
| G3 | Existing `.env` compatibility | Both new keys are **optional with in-code defaults** so current local `.env` files keep booting unchanged |
| G4 | Backoff curve | "very light exponential": `delay(attempt) = min(BASE_BACKOFF_MS * 2^retryIndex, MAX_BACKOFF_MS)` with `MAX_BACKOFF_MS = 160` (named constant in `src/numerator/numerator.constants.ts`) |
| G5 | CAS conflict detection | axios rejects 4xx; conflict = AxiosError with `status === 400` **AND** body containing numeric `currentNumerator` (the mock's contract). Anything else (5xx, other 400, network/timeout) → **fail immediately** wrapped in a domain error — retries are exclusively for conflicts (TODO §1.3/§1.4 literal reading) |
| G6 | Retry loop shape | Follow TODO §1.3 pseudocode literally: each attempt re-`GET`s current value (`currentNumerator` from the 400 body is used only for logging, not to skip the GET). Simple `for` loop + `await sleep()`, helper `private sleep(ms)` — max 2 params everywhere |
| G7 | Invalid value defense | `GET /numerator` body must carry a finite number; candidate = `current + 1` re-checked `Number.isSafeInteger`. Violation → immediate domain error (no retry) — TODO §1.3 step 2 "verify current is a valid number" + §1.4 |
| G8 | Domain error classes | Task 1 owns `src/numerator/errors/numerator.errors.ts` (classes: `NumeratorUnavailableError` for network/timeout/5xx/unexpected-status, `NumeratorRetriesExhaustedError` for exhausted retries, `InvalidNumeratorValueError` for G7); Task 2 owns `src/json-server/errors/json-server.errors.ts` (`JsonServerRequestError` carrying resource + status + message) |
| G9 | Return of `getNextId` | `Promise<string>` via `String(candidate)` — json-server string-id convention |
| G10 | Payload transport types | `CreateTransactionPayload` / `CreateReceivablePayload` interfaces in `src/json-server/interfaces/` (one file each), **transport-only**: the client does not calculate fees, mask cards, or default anything — TODO §2.4 "it only transports the data it receives" |
| G11 | json-server response handling | Return `response.data` cast to TODO-03 `TransactionResponseDto` / `ReceivableResponseDto` (type-only import from `src/transactions/dto/` — no module dependency; runtime body is echoed by json-server) — TODO §2.3 |
| G12 | HTTP timeout | Every client module imports `HttpModule.forRoot({ timeout: 4000 })` (TODO §"Configuration & resilience": 3–5 s). Constant lives in `src/common/constants/http-timeout.constants.ts` (`HTTP_TIMEOUT_MS = 4000`) — verify `forRoot`/`register` availability against installed `@nestjs/axios` v4 during 4.1 implementation research |
| G13 | Logging | NestJS `Logger` per service. `NumeratorService` logs a warning with attempt number + current + candidate on every conflict. Never log request bodies on the json-server client (card data privacy, TODO §"Configuration & resilience"); numeric numerator values are non-sensitive and may be logged |
| G14 | Module exports/registration | `NumeratorModule` exports `NumeratorService`; `JsonServerModule` exports `JsonServerService`; both imported in `src/app.module.ts` (Task 3) so they become injectable everywhere without further wiring (TODO §2.3 "fully usable as injectable NestJS providers") |
| G15 | Structure map | `.agent/project-structure.md` gains `src/numerator/`, `src/json-server/` (+ their subfolders), per the Project Structure Rule — updated in Task 3 commit series |
| G16 | Verification (no tests per TODO) | `npm run build` + `npm run lint` must exit 0; no HTTP smoke tests (no endpoint exists); dev-server boot check optional per-task if port 3001 is free |
| G17 | Docs | `docs/app-setup.md` gains the two new env vars + an "External clients" section (Task 3 docs cycle); JSDoc headers per existing house style on every new file |
| G18 | Architecture doc drift | `architecture.md` "Concurrency Strategy" mentions 5 attempts / 50 ms base / 503; the **TODO governs this task**: 10 retries / 20 ms base. The TODO requires throwing *application error classes*, not HTTP 503 mapping (mapping is orchestration's job — later TODO). Noted as accepted deviation, reconciled in 4.4/4.5 of Task 1 |
| G19 | Untracked TODO files | `.agent/todos/20260913/20260913-todo-4.md` and `-todo-5.md` remain **uncommitted** user-owned files. Step 4.6 adds `[DONE]` marks to todo-4.md **without staging/committing content changes beyond the user's request** — the file itself stays untracked (consistent with step 5 of prior runs; the `[DONE]` edit is a user-requested annotation on a user-owned file) |

## Per-task pre-analysis

### Task 1 — Numerator Client

- Scope: `src/numerator/numerator.service.ts` (public `getNextId(): Promise<string>`, private `getCurrentNumerator()`, private `testAndSet(oldValue, newValue)` — note 2-param limit satisfied; `testAndSet` takes a typed `CasParams` object if a third arg would creep in), `src/numerator/errors/numerator.errors.ts`, `src/numerator/numerator.constants.ts` (max-retries/backoff defaults, `MAX_BACKOFF_MS`), config plumbing G1/G2/G3 (`env.validation.ts`, `config.keys.ts`, `.env.example`).
- Behavior: retry loop per G5/G6/G7; conflict logging per G13; string return per G9.
- A module file is NOT strictly required here, but the TODO §1.5 mandates "dedicated NestJS module + service": create `numerator.module.ts` in Task 1 as a minimal `@Module({ imports: [HttpModule], providers: [NumeratorService], exports: [NumeratorService] })`; Task 3 upgrades it to the timeout-configured `HttpModule.forRoot` form and registers it in `AppModule` — this split keeps each task independently reviewable. (Decision T1-D1; the alternative "no module until Task 3" is rejected as it violates §1.5 at end of Task 1.)
- Front-end: no. Tests: none (TODO explicit).
- Known mock facts for the plan: endpoints `GET /numerator` → `{ numerator: number }`; `PUT /numerator/test-and-set` body `{ oldValue, newValue }` → `{ numerator: newValue }` or 400 `{ error, currentNumerator }`; non-numeric body fields also produce a 400 (`Invalid values for test-and-set`) **without** `currentNumerator` — that shape difference is the G5 discriminator.

### Task 2 — json-server Client

- Scope: `src/json-server/json-server.service.ts` with `createTransaction(payload): Promise<TransactionResponseDto>` and `createReceivable(payload): Promise<ReceivableResponseDto>`; `interfaces/` payload types (G10); `errors/` (G8); minimal `json-server.module.ts` created here (same T1-D1 pattern), finalized in Task 3.
- Endpoints: `POST {JSON_SERVER_URL}/transactions`, `POST {JSON_SERVER_URL}/receivables`; base URL via `ConfigKeys.JsonServerUrl`.
- On 4xx/5xx: wrap in `JsonServerRequestError` (resource name + HTTP status + upstream message) — fail-fast, no retries (out of scope).
- Front-end: no. Tests: none.

### Task 3 — Module registration

- Scope: both modules import `HttpModule.forRoot({ timeout: HTTP_TIMEOUT_MS })` (G12); services exported (G14); both modules added to `AppModule` imports; `HTTP_TIMEOUT_MS` constant file (G12); injectability sanity check.
- Docs/structure: G15 + G17; plus any env-var/behavior documentation surfaced by tasks 1–2.
- Front-end: no. Tests: none.

## Execution sequence (each 4.x is one isolated `task` invocation)

```text
Step 2: Git Feature Branch Setup (create feat/external-clients; keep todo-4/5 untracked) => implementer
Step 3: Version Update 0.2.0 → 0.3.0 => implementer

Task 1 (Numerator Client):
  1.1 4.1b Analysis & Planning => architector            → plan: .kilo/plans/20260913-numerator-client.md
  1.2   [user approval of task plan, unless global auto-approved with task auto-approve]
  1.3 4.2 Implementation => implementer                  (build+lint gate G16, commit)
  1.4 4.3 Code Review & Simplification => code-reviewer ∥ code-simplifier
      1.4-fix applied => implementer (max 3 cycles)
  1.5 4.4 Documentation => docs-specialist
  1.6 4.5b Overall Plan Adherence => architector
  1.7 4.6 Task Completion ([DONE] in todo-4.md §Task 1) => implementer

Task 2 (json-server Client):
  2.1 4.1b => architector   → .kilo/plans/20260913-jsonserver-client.md
  2.2–2.6 same sub-step cycle (4.2 implementer, 4.3 reviewer+simplifier, 4.4 docs, 4.5b architector, 4.6 completion)

Task 3 (Module registration):
  3.1 4.1b => architector   → .kilo/plans/20260913-client-modules-registration.md
  3.2–3.6 same sub-step cycle

Step 5: TODO File Completion (rename todo-4.md → -DONE if tracked? NOTE G19: file is untracked user-owned — rename stays in working tree, untracked; merge feat/external-clients → main; push origin main) => implementer
Step 6: Resume + next-TODO handoff text => planner
```

> Step-5 note: prior runs renamed the TODO file with the `-DONE` suffix. todo-4.md is untracked, so the rename is purely local per G19. If user prefers todo-4.md untouched instead, say so when approving.

## Risk register

- CAS conflict detection depends on the mock's error-body shape (G5); a stricter/looser `currentNumerator` presence check is the only real functional risk → covered by review cycle 4.3.
- `MAX_RETRIES` is a generic env name; adopting TODO's literal name (G1) over `NUMERATOR_MAX_RETRIES` to stay verbatim with the task spec.
- `@nestjs/axios` v4 `HttpModule.forRoot` API surface must be verified against installed package before coding G12.
