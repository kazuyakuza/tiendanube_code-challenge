# Global Plan — TODO-06: Transactions Controller & Error Handling

- TODO file: `.agent/todos/20260913/20260913-todo-6.md`
- Date: 2026-09-14
- Branch (step 2): `feat/transactions-endpoint` from `main` (`ef7b49b`, clean tree)
- Version bump (step 3): `0.4.0` → `0.5.0` (minor — new feature surface)
- Front-end related: **NO** (pure backend). Sub-steps 4.1a / 4.5a are skipped for all cycles.

## 1. Task parsing (TODO file format)

Pattern B (`# Title` → `##` sections). Actionable headings: `## Task 1. Controller`,
`## Task 2. Error handling & consistency`, `## Task 3. Module & wiring`
(Goal/Context/Out of scope/Implementation guidance are not tasks).

**Parsing decision (workflow "extremely short/related" join clause):**

- **Cycle A — "Controller & wiring" = Task 1 + Task 3.** Task 3 is two module lines
  meaningless without Task 1's controller; they are inseparable facets of one
  deliverable (bind `POST /v1/transactions` → `TransactionsService.create`).
- **Cycle B — "Error handling & compensation" = Task 2.** Substantive and separable:
  global exception filter + domain-error→HTTP mapping + partial-failure
  compensation class + service `try/catch` change.

Each cycle runs its own full 4.1b → 4.6 cycle. NO task is front-end related.

## 2. Verified current state (pre-analysis)

- `TransactionsService.create(dto)` exists (TODO-05), returns envelope or `undefined`
  gated by `TRANSACTIONS_RETURN_BODY`; **zero try/catch — domain errors propagate raw**.
- `TransactionsModule` provides + exports the service; imported in `AppModule`;
  **NO controller ⇒ `POST /v1/transactions` currently 404s**.
- `ApiKeyGuard` registered globally via `APP_GUARD` (`@nestjs/core`) → every
  non-`@Public()` matched route already requires `x-api-key` (401 on missing/wrong).
- Global `ValidationPipe` (whitelist/forbid/transform) → DTO failures = 400.
- `TRANSACTIONS_RETURN_BODY` validated in `env.validation.ts`, key in `ConfigKeys`.
- Domain errors available for mapping: `NumeratorUnavailableError`,
  `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError` (all → 503);
  `JsonServerRequestError` carries `status: number | undefined`
  (undefined ⇒ network/timeout → 503; ≥500 → 503; 4xx → 502).
- `common/filters/` is documented in `architecture.md` as **planned — empty dir**.
- json-server client has NO delete capability, and TODO §Out of scope forbids
  changing `src/json-server/` or `src/numerator/`.
- Swagger `/docs` currently lists only the health probe; `API-Key` scheme +
  document-level security requirement already configured in `main.ts`.

## 3. Global architectural decisions (binding for both cycles)

- **G1 — Guard application:** rely on the existing global `APP_GUARD` registration;
  do NOT add `@UseGuards(ApiKeyGuard)` on the controller (redundant second
  enforcement). Task 3's "apply the API Key guard on the controller or route" is
  satisfied by the global guard; controller JSDoc must state this explicitly.
  Health controller keeps `@Public()`; the transactions controller must NOT.
- **G2 — Response-body toggle:** already decided at SERVICE level in TODO-05 (D3:
  `create()` returns envelope or `undefined`). Controller returns the service
  result directly; Nest serializes `undefined` as a **201 with empty body**.
  Do NOT add a second controller-level gate reading the same env key.
  §1.2 behavior is thereby satisfied end-to-end with zero new configuration.
- **G3 — Thin controller:** validate→call→return only; no business logic, no
  try/catch, no error mapping in the controller (G4 owns mapping).
- **G4 — Error→HTTP mapping lives in a global exception filter**
  (`src/common/filters/`), NOT in the controller and NOT in the services:
  - `NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` /
    `InvalidNumeratorValueError` → `ServiceUnavailableException` (503), message
    preserved (e.g. "Numerator ID reservation failed after N attempts").
  - `JsonServerRequestError`: `status === undefined` or `status >= 500` → 503;
    `400 <= status <= 499` → 502 Bad Gateway (message includes resource + status,
    never payload).
  - All `HttpException` (guard 401, ValidationPipe 400, router 404) and any
    unhandled error → structured `{ statusCode, message, error }` JSON;
    unknown non-HTTP errors → 500 "Internal server error" with NO stack/internal
    detail leaked when `NODE_ENV === 'production'` (logged server-side instead).
  - Registered as `APP_FILTER` provider in `app.module.ts` (consistent with the
    `APP_GUARD` pattern), not `useGlobalFilters` in `main.ts`.
- **G5 — Partial-failure compensation (Task 2.2):** new dedicated class
  `TransactionCompensationService` in `src/transactions/compensation/` (or
  `src/transactions/` — final placement decided in cycle-B plan) that issues
  `DELETE {JSON_SERVER_URL}/transactions/:id` via an injected `HttpService`, with
  a **retry loop + sleep backoff + max attempts** whose defaults live in a new
  named-constants file (single source, magic-number rule; suggested defaults:
  3 attempts, 200 ms base backoff — cycle-B plan must fix exact values).
  - `TransactionsService.create()` gains the ONLY allowed try/catch: around the
    `createReceivable` call. On failure → await compensation → on compensation
    failure `Logger.error` the inconsistency (ids + reason ONLY, no card data,
    per privacy rule T2-D7) → **re-throw the ORIGINAL receivable error** so G4
    still maps it to 5xx for the client. Compensation success also logs one
    warn line; client still receives the error (state = consistent, no orphan).
  - Constraint honored: `src/json-server/` and `src/numerator/` files get ZERO
    diffs (§Out of scope); the compensation DELETE is a NEW consumer class, not a
    client modification. `TransactionsModule` imports its own
    `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (isolated-instance
    precedent T3-D2; JsonServerModule does not export `HttpService`).
  - Goal per TODO: reduce, not eliminate, orphans. No saga framework.
- **G6 — Swagger authoring:** annotate the controller method so `/docs` fully
  documents the operation. The TODO names legacy decorators (`@ApiOperation`,
  `@ApiBody`, `@ApiCreatedResponse`, `@ApiUnauthorizedResponse`,
  `@ApiBadRequestResponse`, `@ApiServiceUnavailableResponse`); installed
  `@nestjs/swagger` is v11.2.x — the cycle-A plan MUST verify (context7 / node_modules)
  which decorator form is non-deprecated in that version and pick ONE form that
  renders the same contract: body → `CreateTransactionDto` example
  (public test PAN `4111111111111111` already used in DTO examples), 201 →
  `CreateTransactionResponseDto`, 400/401/502/503/500 error responses.
  `x-api-key` security: document-level requirement already exists (T5) — verify
  the operation inherits it; add operation-level `@ApiSecurity`/`security` only
  if the generated document omits it.
- **G7 — Frozen surfaces this cycle:** `src/numerator/`, `src/json-server/`,
  all existing DTOs, enums, validators, constants, `env.validation.ts`,
  `config.keys.ts` (no new env keys required — G2/G5 use existing values or
  in-code constants). `transactions.service.ts` changes ONLY per G5 try/catch.
  DTO/Response files touched ONLY if the cycle-A plan finds a missing
  `@ApiProperty` needed for Swagger rendering (report as deviation if it does).
- **G8 — Line/structure rules:** every new source file ≤ 200 lines (target ≤ 125
  effective), methods ≤ 50 lines, max nesting 2, ≤ 2 params (param objects in
  their own interface file where needed), private members by default,
  self-documenting names, no commented code.
- **G9 — Verification gates per cycle:** `npm run build` exit 0, `npm run lint`
  exit 0, `npm test` exit 0 (`passWithNoTests`). NO live curl/docker execution by
  agents (docker/external services are user-run per established convention);
  the TODO's manual test block is handed to the user at step 6. e2e/unit tests
  remain TODO-07 (§Out of scope).
- **G10 — 404 catch-all decision:** a filter turning unmatched routes into a
  structured 404 body comes FOR FREE with G4's filter only if it catches
  Nest's NotFoundException — G4 already re-emits HttpExceptions structurally,
  so unmatched routes (404 NotFoundException) get the same JSON shape. No extra
  work beyond that; do not add custom 404 logic.

## 4. Cycle A — "Controller & wiring" (TODO Task 1 + Task 3)

Deliverables: `src/transactions/transactions.controller.ts` mounted at
`transactions` (versioned → `/v1/transactions` by the global `defaultVersion: '1'`),
single `@Post()` handler taking `@Body() CreateTransactionDto` → awaiting
`TransactionsService.create(dto)`; `@HttpCode(HttpStatus.CREATED)`; module
`controllers: [TransactionsController]`. Full Swagger per G6. 201 envelope/empty
per G2. Result gates green per G9.

- 4.1b Analysis & Planning → architector (per-task plan: `.kilo/plans/20260914-transactions-controller.md`)
- 4.2 Implementation → implementer (commits: controller + module wiring)
- 4.3 Code review + simplification → code-reviewer ∥ code-simplifier → implementer fixes if a plan lands
- 4.4 Documentation → docs-specialist (JSDoc, `docs/app-setup.md` endpoint now
  reachable — flips the standing "everything 404s / zero outbound HTTP" truth,
  `architecture.md` + `.agent/project-structure.md` deltas)
- 4.5b Plan adherence → architector
- 4.6 Task completion → implementer (`[DONE]` on §Task 1 + §Task 3, commit)

## 5. Cycle B — "Error handling & compensation" (TODO Task 2)

Deliverables: global exception filter under `src/common/filters/` per G4 registered
via `APP_FILTER`; compensation class + constants per G5; `TransactionsService`
receivable-failure path per G5; error table of §2.1 fully honored end-to-end
(400/401 pre-existing; 503/502/500 from the filter). No stack leak in production
per G4. Result gates green per G9.

- 4.1b Analysis & Planning → architector (per-task plan: `.kilo/plans/20260914-error-handling-compensation.md`;
  must resolve: filter class layout (single vs domain-mapping + fallback),
  exception-body `error` phrase table, compensation constants/backoff shape,
  service diff)
- 4.2 Implementation → implementer
- 4.3 Code review + simplification → code-reviewer ∥ code-simplifier → implementer fixes if needed
- 4.4 Documentation → docs-specialist (error-response guide for `/docs`
  consumers, compensation semantics doc, `architecture.md` Status update of the
  Error & Response Conventions §)
- 4.5b Plan adherence → architector
- 4.6 Task completion → implementer (`[DONE]` on §Task 2, preserving all prior file content)

## 6. Steps 2, 3, 5, 6 (workflow-level)

- **Step 2** (⇒ after approval, first): implementer — commit any pending state
  (tree is currently clean), checkout/create `feat/transactions-endpoint`.
  Branch ops are RESTRICTED to step 2.
- **Step 3:** implementer — bump `package.json` `0.4.0` → `0.5.0`,
  commit `chore: bump version to 0.5.0`. Version ops RESTRICTED to step 3.
- **Step 5:** implementer — rename TODO file to `20260913-todo-6-DONE.md`
  (content preserved), remove tmp artifacts, verify all committed on feature
  branch, `main` merge via `--no-ff`, delete branch after verified merge, push
  `main` to `origin` ONLY (git-remote-safety rule). Push RESTRICTED to step 5.
- **Step 6:** Planner presents summary + copy-paste prompt for the next TODO
  (`.agent/todos/20260913/20260913-todo-7.md` — expected: tests cycle).

## 7. Risks & watch-items

- R1: Legacy vs modern Swagger decorators in v11 (G6) — wrong assumption yields
  a non-rendering doc; cycle-A plan must verify against installed package, not memory.
- R2: The filter must NEVER swallow/mangle guard 401s and ValidationPipe 400s
  (G4 pass-through) — regression risk in the most-tested contract paths; cycle-B
  plan must include a self-check for status/shape of an authenticated 201 and an
  anonymous 401 via build-only reasoning + (TODO-07) tests — flag any uncertainty.
- R3: Compensation must not mask the original error (rethrow original, G5) —
  review checkpoint in 4.3.
- R4: Service `create()` returns `undefined` with `HttpCode(201)` — confirm Nest
  emits `201` with empty body when the handler resolves `undefined`
  (cycle-A plan verifies; if Express sends 200, add explicit empty-response
  handling inside the thin contract, logged as deviation).
- R5: `architecture.md`/`docs/app-setup.md` carry many "zero outbound HTTP /
  everything 404s" truth statements across TODO-02…05 — the docs steps MUST sweep
  them to post-controller truth (both cycles may touch; cycle-A owns the flip).

## 8. Approvals

- 2026-09-14: Global plan PRESENTED to user; approval = **"Approve Global and
  Tasks Plans"** — steps 4.1b per cycle execute with per-task plans
  **auto-approved** (no per-plan user gates). Two cycles confirmed: A
  (Task 1 + Task 3, controller & wiring), B (Task 2, error handling &
  compensation). Execution started from workflow step 2.
