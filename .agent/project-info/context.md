# Context — Current State

[Project Info: Active]

## Current Work Focus

**TODO-06 RUNTIME-COMPLETE (branch `feat/transactions-endpoint`) — BOTH
cycles LANDED; awaiting the workflow's step-5 closure (TODO-file
rename/merge/push are deliberately NOT done yet).** `POST /v1/transactions`
is LIVE: commit `d12676f`
added the thin `TransactionsController` (registered in
`TransactionsModule`) — auth through the existing global `ApiKeyGuard`
(401 on missing/wrong `x-api-key`), global ValidationPipe 400, 201
`{ transaction, receivable }` envelope or **bare 201** per the
service-level `TRANSACTIONS_RETURN_BODY` gate, full Swagger operation at
`/docs`. The route now invokes `TransactionsService.create()` end-to-end,
so outbound HTTP to the mock services happens while it is called (boot is
still config-reads-only). **Cycle B (§Task 2 of the same TODO file —
global exception filter G4 + partial-failure compensation G5) is LANDED
on this same branch:** the global `AllExceptionsFilter` (`APP_FILTER`)
now answers every failure with the structured `{ statusCode, message,
error }` body (Numerator errors → 503; `JsonServerRequestError` → 503 on
unknown/≥500, **502** on 4xx, messages verbatim; guard-401 / pipe-400 —
array `message` preserved — and router-404 pass through unchanged;
unknown errors → generic 500 everywhere + server-side stack log ONLY,
leak impossible by construction), and a receivable-write failure after
the transaction was persisted is compensated by
`TransactionCompensationService.deleteTransaction` (bounded DELETE retry:
3 attempts, 200×2^n ms capped 1600 ms, 404 = already-gone = success,
NEVER throws) before the ORIGINAL error is rethrown; a survivor orphan
logs one `logger.error` ids+reason line — orphans **reduced, not
eliminated** (§2.2). Gates per cycle: build/lint/test exit 0 + temp
`ERROR-SANITY-OK` in-process filter proof. Still open: §Task 2 `[DONE]`
(4.5b/4.6) and workflow step 5 (TODO archive/merge/push) — §Task 1/§3
were `[DONE]`-marked at `8133d5a`.

**Previous cycles closed:** TODO-05 (orchestration service — merged to
`main` at `5cf97ef`, pushed), TODO-04 (external clients — merged at
`f0a979a`, pushed), TODO-03 (DTO layer), TODO-02 (foundation).

## Recent Changes

- 2026-09-14: TODO-06 **Cycle B** — error handling & compensation
  (§Task 2 §2.1–§2.3 of `.agent/todos/20260913/20260913-todo-6.md`; same
  branch `feat/transactions-endpoint`; binding global-plan G4/G5/G7 +
  gates G9; cycle plan decisions CB-D1…CB-D8). 4.2 commits: **`2416915`**
  new `src/common/filters/all-exceptions.filter.ts` — single catch-all
  `@Catch()` `AllExceptionsFilter`, registered `APP_FILTER`
  (`@nestjs/core`) in `app.module.ts`: every reply is the structured
  `{ statusCode, message, error }` body; `HttpException`s (pipe-400 with
  its **string-array** `message`, guard-401, router-404/G10) re-emit their
  own status+shape VERBATIM (CB-D2a); Numerator domain errors → **503**;
  `JsonServerRequestError` → **503** on unknown/≥500 and **502** on 4xx —
  502 chosen over the "or 500" alternative (upstream contract anomaly
  behind this gateway; matches Cycle-A `@ApiBadGatewayResponse`) — domain
  messages verbatim (payload-safe by construction, CB-D2b); unknown →
  generic 500 in EVERY environment with `message+stack` server-side
  `Logger.error` ONLY, no ConfigService/NODE_ENV read — production
  no-leak by construction (CB-D3 log-only); local `HTTP_STATUS_PHRASES`
  map, zero new deps (`http-status` rejected). **`1b73935`** compensation:
  `compensation.constants.ts` (3 attempts / 200 ms base / 1600 ms cap —
  in-code knobs, NO new env keys per G7),
  `TransactionCompensationService.deleteTransaction` — bounded DELETE of
  the orphaned `{JSON_SERVER_URL}/transactions/:id`, 404 = already-gone =
  success (CB-D4a), **NEVER throws** (`true`/`false`, CB-D4) — over the
  `TransactionsModule`'s OWN `HttpModule.register({ timeout })` instance
  (CB-D5, T3-D2; service provided, not exported; `src/json-server/`
  ZERO diffs, constant imported only) — plus the pipeline's **only**
  try/catch in `TransactionsService.create()` wrapping exactly
  `createReceivable` and catching ANY error (CB-D6: the row is already
  persisted then; Numerator fails stay pre-write/outside), awaiting
  `compensateOrphanedTransaction` then **rethrowing the ORIGINAL error**
  (never masked, G5/R3); a surviving orphan yields ONE `logger.error`
  ids+reason line and the client STILL gets the mapped error — orphans
  **reduced, not eliminated** (§2.2; no saga/circuit-breaker).
  **`271c94b`** = CB-D7 controller Swagger/JSDoc truth fix. 4.3: review
  fix **`35d314d`** — filter booleans extracted to single-section helpers
  `isNumeratorError`/`isUpstreamFailure` (recorded deviation:
  `isNumeratorError` returns a TS **type predicate**, beyond the plan
  snippet, to preserve `resolveDomainBody` narrowing; behavior identical);
  simplify **`6e709f9`** — stale-comment sweep + reason-computation hoist
  (behavior identical). Gates: `npm run build`/`lint`/`test` exit 0 +
  temp in-process `tmp-error-sanity.js` printing **`ERROR-SANITY-OK`**
  asserting the full table above incl. the 400 array-message pass-through
  regression check (CB-D8; deleted after, never committed — supertest
  boot rejected as overkill for the same code path). This 4.4 docs step
  (this bullet): tree-wide stale-claim sweep — comment-only G18 pointer
  flips in the G7-frozen client headers (`numerator.service.ts`,
  `numerator.errors.ts`, `json-server.errors.ts`: mapping is now LIVE in
  the filter; precedent: TODO-05/Cycle-A 4.4 sweeps), `docs/app-setup.md`
  pending-callout flips + new "Error handling & compensation (TODO-06
  Cycle B)" section (§2.1 contract table, 502 rationale, CB-D3
  generic-500 rule, privacy rule, compensation knob table, user-run
  fault-injection recipes incl. the honest 502/compensation deferred-to-
  TODO-07 note + production stack check), `architecture.md` header STATUS
  + Cycle-B dated entry + tree/conventions/concurrency flips,
  `.agent/project-structure.md` filters/ + compensation lines,
  this file. Remaining TODO-06 work: §Task 2 `[DONE]` (4.6) + step-5
  archive/merge only; tests = TODO-07.

- 2026-09-14: TODO-06 **Cycle A** — transactions controller & wiring
  (§Task 1 + §Task 3 of `.agent/todos/20260913/20260913-todo-6.md`; global
  plan `.kilo/plans/20260914-transactions-endpoint.md` G1–G10; cycle plan
  `.kilo/plans/20260914-transactions-controller.md` CA-D1…CA-D8; branch
  `feat/transactions-endpoint`). Step 3 bump: `eb65852` → v`0.5.0`.
  4.2 commit **`d12676f`**: new `src/transactions/transactions.controller.ts`
  (thin G3 handler — `@Controller('transactions')` + one `@Post()`;
  `CreateTransactionDto` → global-guard **401** auth (G1: no
  `@UseGuards`/`@Public()` — existing `APP_GUARD` is the single
  enforcement) → global ValidationPipe **400** → direct relay of
  `TransactionsService.create(dto)` ⇒ **201 envelope** or **bare 201**
  (`undefined` + `@HttpCode(201)` nil-body send — G2, verified vs
  `express-adapter.js` + health-probe precedent); legacy Swagger decorator
  set + `@ApiBadGateway`/`@ApiInternalServerError`, verified
  non-deprecated in installed `@nestjs/swagger` 11.4.7 (F1); operation
  inherits doc-level `x-api-key` requirement (F4/CA-D3)) +
  `transactions.module.ts` (`controllers: [TransactionsController]` +
  truthful header). Single-commit deliverable (CA-D4). Gates (G9):
  `npm run build` + `npm run lint` + `npm test` exit 0 + temp `DI-SANITY-OK`
  boot (CA-D5, deleted after run). **Cycle A froze clients/DTOs/service
  (G7): domain errors still propagate raw ⇒ currently Nest default 500 on
  the live route; 502/503 mapping + compensation = Cycle B.** 4.3:
  code-reviewer = **NO FIX PLAN**; code-simplifier = **NONE**. 4.4 docs
  step (this bullet): comment-only JSDoc truth sweep across `src/`
  (module verified; `app.module.ts`, `transactions.service.ts`, all 4 DTO
  headers, both validators, `payment-method.enum.ts`,
  `env.validation.ts` + `config.keys.ts` — every "no controller yet /
  route 404s / zero outbound / bare-201 awaits the controller" statement
  flipped to endpoint reality), `docs/app-setup.md` new "Transactions
  endpoint (TODO-06 Cycle A)" section + behavior/wiring/pending-work flips
  throughout, `.agent/project-structure.md` transactions line,
  `architecture.md` dated entry + header STATUS + tree + flow-filter
  statuses,   this file. TODO-06 §Task 1/§3 `[DONE]` marks landed at `8133d5a`; §Task 2
  (Cycle B) implemented AFTER this bullet — see the Cycle-B bullet below;
  open mechanics now: §Task 2 `[DONE]` (4.6) + step 5 for the whole TODO.

- 2026-09-14: TODO-05 step-5 closure — renamed `20260913-todo-5.md` →
  `20260913-todo-5-DONE.md` (commit `586ecbf`), merged to `main` via
  `--no-ff` (merge `5cf97ef`), build+lint green, pushed to `origin`. All 5
  §Task headings `[DONE]`. Files landed in this cycle: `fee-rules.ts`,
  `transactions.service.ts`, `transactions.module.ts` + `app.module` import;
  4.3 = NO FIX PLAN + 1 simplification `7b2176c`; 4.4 = `f3f6b81`
  comment-only truth sweep incl. 12 frozen-file JSDoc + docs/structure/
  project-info; 4.5b = ADHERENT WITH ACCEPTED DEVIATIONS. Step-8 branch
  cleanup: `feat/transaction-orchestration` deleted.

- 2026-09-14: TODO-05 cycle — **transaction orchestration service
  (service layer only)** (branch `feat/transaction-orchestration`; global plan
  `.kilo/plans/20260914-transaction-orchestration.md` T5-G1…G13 + impl plan
  `...-impl.md` with §8 deviations D1–D6; TODO file
  `20260913-todo-5.md` — **file-handle cycle number TODO-05** (its internal
  "TODO 04" title names the orchestration task; external clients were
  todo-4). Step 3 bump: `1cd2a55` → v`0.4.0`. **Task-parsing decision: the
  five `## Task` sections + wiring ran as ONE merged 4.1–4.6 cycle** (user
  approved — inseparable facets of the single service deliverable; the plan's
  "extremely short/related" join clause, not five independent cycles).
  4.2 commits: **`207f79c`** new `src/transactions/fee-rules.ts` (pure
  `resolveReceivableStatus`, `computeTotal` — integer-cents math **truncated**
  to exactly 2 decimals `floor(cents × remaining% / 100)`, never rounding;
  `formatDateDDMMYYYY` local-now `DD/MM/YYYY`), **`759bb62`** new
  `transactions.service.ts` (`TransactionsService.create(dto)` — TODO §Flow
  9-step strict order: both `getNextId()` reservations before any write
  (zero-orphan risk), `maskCardNumber` applied on the write path, fee data
  = status + fee-% string discount + cents-truncated total + `create_date`,
  strict transaction→receivable persistence, envelope-or-`undefined` return
  gated service-level by `TRANSACTIONS_RETURN_BODY` via `get(key, true)`;
  **zero try/catch — domain errors propagate raw; a failed second write
  leaves an ACCEPTED partial-written state (TODO §Error)**; in-file
  `ReservedIds`/payload-context param objects for the 2-params rule) +
  `transactions.module.ts` (imports `NumeratorModule`+`JsonServerModule`,
  provides + **exports** the service, **no controller/route**), `AppModule`
  import + header-JSDoc refresh (the "NO business route" note stays TRUE).
  4.3: code-reviewer = **NO FIX PLAN**; code-simplifier = **ONE worthwhile
  change, applied in `7b2176c`** (`computeTotal` net-percent hoist,
  behavior-identical, per `20260914-transaction-orchestration-simplify.md`);
  other candidates rejected/logged. Verification: `npm run build` +
  `npm run lint` exit 0 (T5-G11 gate). **User ruling Option-B (impl §8 D1):
  NO `payment_date` field and NO add-days/D+30 computation anywhere** —
  D+0/D+30 settlement is carried purely by receivable `status`
  (`paid`/`waiting_funds`); `create_date` = local now `DD/MM/YYYY`;
  TODO §Fee's payment-date line superseded. **T5-G13 frozen surfaces: ZERO
  diffs to `src/numerator/`, `src/json-server/`, existing DTOs, enums,
  validators, constants** (transport interfaces unchanged). Deviation
  D3 kept: public return widened to `Promise<CreateTransactionResponseDto |
  undefined>` (TODO §Task 1 literal signature superseded by D-DECISION/T5-G6).
  **Runtime truth unchanged: still no controller ⇒ `POST /v1/transactions`
  404s; app performs zero outbound HTTP calls; `TRANSACTIONS_RETURN_BODY` and
  `maskCardNumber` moved plumbing/helper ⇒ gate/call-sites live but
  unexercised from HTTP; Swagger `/docs` still health-only.** 4.4 docs step
  (this bullet): JSDoc truth-sweep of frozen comment files (`config.keys.ts`,
  `env.validation.ts`, `card-number.util.ts`, `payment-fee.constants.ts`,
  both enums, all 4 DTO headers), `app.module.ts` verified truthful,
  `docs/app-setup.md` new "Transactions orchestration service (TODO-05)"
  section + TODO-03/env-table/consumed-now flips, real example table,
  `docs/json-server-client.md` first-consumer flips,
  `.agent/project-structure.md` transactions line, `architecture.md` dated
  entry + tree lines + Request-Data-Flow step statuses (3–6 implemented at
  service layer / 7 controller-pending), `tech.md` no content delta
  (no new deps/env/commands). `app.module.ts` JSDoc + `AGENTS.md` untouched
  by this 4.4 (already truthful). Out of scope honored: no controller, no
  route, no Swagger decorators, no compensation/saga, no tests. **4.5b/4.6
  were still open when this bullet was written.** Next runtime work: the
  controller TODO (binds `POST /v1/transactions` → the existing `create()`).

- 2026-09-14: TODO-04 cycle Task 3 — module registration (branch
  `feat/external-clients`; single 4.2 commit `7a4a149`). New
  `src/common/constants/http-timeout.constants.ts` (`HTTP_TIMEOUT_MS = 4000`,
  G12); `numerator.module.ts` + `json-server.module.ts` upgraded from the
  bare `HttpModule` to per-module `HttpModule.register({ timeout:
  HTTP_TIMEOUT_MS })` (T3-D1: v4 has no `forRoot`; T3-D2: each module gets
  its own isolated configured axios instance; JSDoc refreshed in the same
  files) and both added to `AppModule.imports` next to `HealthModule` (G14),
  with an app.module header note that NO business route exists — clients
  boot with config reads only, zero outbound HTTP until orchestration.
  Services of Tasks 1–2 frozen (zero diff). Verification per plan §3.5:
  temp `tmp-di-sanity.js` boot + resolve of both services printed
  `DI-SANITY-OK` (T3-D3: temp script instead of absent `@nestjs/testing`;
  deleted after run, never committed). 4.3: review = NO FIX PLAN,
  simplification = NONE. No structure-map delta (folder-level map already
  covered; plan §4 Commit-2 decision). 4.4 docs: this cycle —
  `docs/app-setup.md` wiring flips (intro, External-services status, env
  table rows, consumed-now/boot state, External-clients section incl. both
  module rows + shared timeout constant row, "Wiring status & pending work"
  replacing the Task-3-pending list, plan references incl. Task 3 plan),
  `docs/json-server-client.md` banner + wiring section rewritten to
  wired-with-timeout, `architecture.md` Task 3 dated entry + tree lines +
  supersession notes on the Task 1/2 entries, orchestration-controller
  attributions detached from the now-closed TODO-04. 4.5b/4.6 for Task 3
  remain open when this bullet was written. Out-of-scope items stay unbuilt
  (orchestration, fees, masking, controllers, tests — TODO §Out of scope).

- 2026-09-14: TODO-04 cycle Task 2 — json-server client (branch
  `feat/external-clients`; 4.2 commits c827d8b §2.4 transport payload
  interfaces + param objects + domain error, de84780 constants + service +
  module, 7af33e9 structure map). New `src/json-server/`:
  `json-server.service.ts` (`createTransaction` / `createReceivable` —
  `HttpService.post` + `firstValueFrom` to `{JSON_SERVER_URL}/transactions`
  / `/receivables`, echoed body returned with TYPE-only response-DTO typing
  (G11), no 201 assertion (T2-D3), `getOrThrow` base URL with
  trailing-slash normalization once at construction (T2-D1), fail-fast with
  zero success logging and one failure warn carrying resource+status only),
  `json-server.module.ts` (minimal, bare `HttpModule` — T2-D13; Task 3 owns
  `HttpModule.register({ timeout })` + `AppModule`),
  `json-server.constants.ts` (two resource paths; NO timeout constant),
  `errors/json-server.errors.ts` (`JsonServerRequestError` —
  `status: number | undefined`, `undefined` on network/timeout/non-axios
  (T2-D4), message from resource+status+axios reason only — upstream bodies
  never interpolated (T2-D7)), `interfaces/` (the two §2.4 payloads typed
  with the shared enums — DTO reuse rejected (T2-D2), no `dto/` folder
  (T2-D10) — plus two 2-params-rule param objects (T2-D11)). Config: zero
  new keys — `JSON_SERVER_URL` gained its first consumer. 4.3: review = NO
  FIX PLAN REQUIRED, simplification = NO SIMPLIFICATION REQUIRED.
  Deviations/decisions T2-D1…T2-D13 per plan §5 (T2-D12: the stale
  "only key without consumers" JSDoc consumption map was deferred from 4.2
  to the 4.4 sweep — landed). 4.4 docs: `docs/json-server-client.md` NEW
  (endpoints, §2.4 payload tables, failure model, privacy rule, config
  notes, curl wire-shape exercises transcribed — NOT live-verified, docker
  only via user), app-setup "External clients (TODO-04)" compact Task 2
  subsection + TOC/Related-docs links + env-table row, consumed-now and
  pending-lists + plan-reference sweeps (file exceeded ~200 lines, hence
  the split); JSDoc: consumption maps updated in `env.validation.ts` +
  `config.keys.ts`, guide + masking-helper links added in the service /
  transaction-payload headers; `architecture.md` Task 2 entry + tree
  marker + status correction; `tech.md` untouched (no fact changed).
  Tests: none for this client (TODO-04 defers them; documented
  neutrally). Task 1/3 facts unchanged. 4.5b/4.6 were
  still open when this bullet was written.

- 2026-09-13: TODO-04 cycle Task 1 — Numerator client (branch
  `feat/external-clients`; 4.2 commits fa9f723 config knobs, c18eda4 constants
  /errors/interfaces, b36b53c service + module, d56eab3 structure map).
  New `src/numerator/`: `numerator.service.ts` (`getNextId(): Promise<string>`
  per TODO §1.3 — re-`GET` current value every attempt, validate finite
  number + safe-integer candidate, `PUT test-and-set { oldValue, newValue }`,
  retry ONLY genuine conflict (HTTP 400 + numeric `currentNumerator`, plan
  G5; invalid-params 400 fails fast), backoff `min(base × 2^idx, 160 ms)`,
  conflict warn-logs attempt/current/candidate), `numerator.module.ts`
  (minimal, bare `HttpModule` — T1-D1), `numerator.constants.ts` (single
  source for defaults 10/20/160/400 — T1-D5), `errors/numerator.errors.ts`
  (`NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` /
  `InvalidNumeratorValueError`), `interfaces/` (mock wire shapes +
  2-params-rule param objects). Config: OPTIONAL env `MAX_RETRIES` (default
  10) + `NUMERATOR_BASE_BACKOFF_MS` (default 20) validated in
  `env.validation.ts`, `ConfigKeys.MaxRetries` / `NumeratorBaseBackoffMs`,
  commented `.env.example` entries; `NUMERATOR_API_URL` gained its first
  consumer (`getOrThrow` in the service constructor). 4.3: review = NO
  fixes, simplification = NONE. Deviations/decisions T1-D1…T1-D8 per
  plan §5 (T1-D3 structure map pulled into Task 1; T1-D4 standalone
  `isAxiosError` (axios 1.20); T1-D6 architecture reconciliation — landed
  in 4.4; T1-D7 `HttpModule.register` not `forRoot` (v4) — Task 3 input;
  T1-D8 strictNullChecks-safe narrowing). 4.4 docs: JSDoc polish (service
  header mock-source/runbook links; failure-context §refs); `docs/app-setup.md`
  new "External clients (TODO-04)" section (semantics, config flow, curl
  contract exercises transcribed from `numerator-api/api.js` — NOT
  live-verified, services may be down, docker runs only via user), env-table
  rows, status sweeps on "app does not call services yet" wording;
  `architecture.md` T1-D6 revision + cycle entry + tree markers; `tech.md`
  two env rows. Task 2/Task 3 documented strictly as PENDING. 4.5b/4.6 were
  still open when this bullet was written.

- 2026-09-13: TODO-03 cycle TD — transaction DTO & validation contract
  layer (branch `feat/transaction-dtos`; 4.2 commits e73ed43 enums,
  1187b14 `maskCardNumber`, 0718237 custom validators, cfdaf77
  `CreateTransactionDto`, e486a64 response DTOs, 80907e5 env plumbing,
  5af8d3b structure map; 4.3 fix 709835a — public test PAN
  `4111111111111111` request example + matching `'1111'` response example).
  New: `src/common/enums/` (`PaymentMethod`, `ReceivableStatus`),
  `src/common/constants/payment-fee.constants.ts` ("2"/"4" percent
  strings), `src/common/utils/card-number.util.ts`,
  `src/transactions/dto/` request DTO + 3 output-only response DTOs +
  `validators/` (`IsPositiveDecimalString`, `IsFutureExpirationDate` —
  MM/YY end-of-month UTC future validity). `TRANSACTIONS_RETURN_BODY`
  added as optional boolean env (default `true`; `false` ⇒ future bare
  `201 CREATED`), mirroring `SWAGGER_ENABLED` — plumbing only, TODO-04
  owns the consumer. 4.3 review adjudication: docker-scripts /
  `health.controller.ts` findings REJECTED (pre-existing user edits
  checkpointed in step 2 — `30001` in the health curl JSDoc remains a
  flagged user typo, not workflow scope); simplification NONE. 4.4 docs:
  JSDoc headers on every new file, new "DTO & validation layer (TODO-03)"
  section in `docs/app-setup.md`, architecture/context updates. 4.5b
  plan-adherence: ADHERENT WITH ACCEPTED DEVIATIONS. 4.6: `[DONE]` marks
  added to §§1–4. **Not** created (TODO §6): module/controller/service,
  tests, endpoint wiring. Merged to `main` and pushed (step 5).

- 2026-09-13: Global API-key guard (T5 of TODO-02, commit 4ac069f):
  `ApiKeyGuard` (`src/common/guards/api-key.guard.ts`) registered app-wide
  via the `APP_GUARD` provider in `app.module.ts`. Every matched route must
  send `x-api-key` matching env `API_KEY` exactly (plain `===` compare per
  plan G9 — no crypto/timing hardening); missing/wrong key
  → **401** `UnauthorizedException('Missing or invalid x-api-key header')`
  (guard returning `false` would yield 403 — deliberate throw). New
  `@Public()` decorator + shared `IS_PUBLIC_KEY` const
  (`src/common/decorators/public.decorator.ts`), read by the guard via
  `Reflector.getAllAndOverride([handler, class])`, exempts
  `HEAD /health/ping`. Wire-format constants live in
  `src/common/api-key.constants.ts` (`API_KEY_HEADER`, Swagger scheme name
  `API-Key`). Swagger `setupSwagger` adds the `apiKey` scheme +
  document-level security requirement → working **Authorize** button;
  "Try it out" now sends the header (padlock on the public probe is
  cosmetic — T5 decision D10). Guard proven per G10 with a temporary
  protected route that was deleted, never committed. Plan fix recorded:
  the T5 §6 snippet originally imported `APP_GUARD` from `@nestjs/common`;
  it is exported by **`@nestjs/core`** (correction now annotated in the
  plan file). Docs: guard section + Swagger authoring how-to in
  `docs/app-setup.md`; stale "guard not implemented" JSDoc sweeps landed.

- 2026-09-13: Public unversioned health probe (T4 of TODO-02, commits f2ee009
  + 7bf9128): new `src/health/` module — `HealthModule` + `HealthController`
  answering `HEAD /health/ping` with `200 OK` and an empty body. Unversioned
  via `version: VERSION_NEUTRAL` on the controller metadata (G8-R: the
  global-plan `@SkipVersioncheck()` does not exist in the installed
  `@nestjs/common`; no `main.ts` change needed). Public **by absence of any
  guard** — when T5 lands, `HealthController` must get `@Public()` to stay
  reachable. Swagger lists the probe (T4 decision C); simplify step moved the
  curl how-to into the `ping()` JSDoc. Docs: "API behavior at this stage" in
  `docs/app-setup.md` corrected (health answers; every other route public
  until T5).

- 2026-09-13: Hardened application bootstrap (T3 of TODO-02, commits 84bfb15
  + 7c78932): `src/main.ts` wires helmet defaults, env-driven CORS
  (`CORS_ORIGINS` CSV allowlist; absent/blank ⇒ allow all), morgan
  (`NODE_ENV`-conditional format: `dev` in development, `combined`
  otherwise), a global `ValidationPipe`
  (whitelist/forbidNonWhitelisted/transform), URI versioning
  `defaultVersion: '1'` (no `setGlobalPrefix`), Swagger UI at `/docs` gated
  by `SWAGGER_ENABLED`, and listens on the validated PORT. All env reads go
  through `ConfigService` + `ConfigKeys` per plan addendum A3-R
  (`getOrThrow` for required keys; `get(key, default)` for `SWAGGER_ENABLED`);
  simplify step S1 folded `splitOrigins` into `resolveCorsOrigins`. Docs: new
  "API behavior at this stage" section in `docs/app-setup.md` (everything
  404s except `/docs` — no controllers yet).

- 2026-09-13: Validated configuration module (T2 of TODO-02):
  `src/config/env.validation.ts` (class-validator schema — 5 required vars
  `NODE_ENV`/`PORT`/`NUMERATOR_API_URL`/`JSON_SERVER_URL`/`API_KEY` + optional
  `SWAGGER_ENABLED`/`CORS_ORIGINS`; URL fields require a protocol per plan
  addendum A4-R, so protocol-less base URLs fail at startup) and
  `src/config/config.keys.ts` (`ConfigKeys` constants for later consumers);
  global `ConfigModule.forRoot({ isGlobal, cache, validate })` in
  `AppModule`; fail-fast bootstrap error names every offending variable.
  `main.ts` untouched per decision A9 (still reads `process.env.PORT` until
  T3 — that temporary read is gone, superseded by the T3 entry above). Docs:
  new "Environment configuration" section in `docs/app-setup.md`.

- 2026-09-13: Scaffolded NestJS 11 foundation (T1 of TODO-02): root
  `package.json`/lockfile, `tsconfig{,.build}.json`, `nest-cli.json`,
  `eslint.config.mjs`, `test/jest-e2e.json`, minimal `src/main.ts` +
  `src/app.module.ts`, `.env.example` (+ local `.env`), `.gitignore`
  `coverage/`; build/lint/tests verified exit 0. Run guide:
  `docs/app-setup.md`.
- 2026-09-13: Project info initialized. Created `product.md`, `context.md`,
  `architecture.md`, `tech.md`; removed `.initialized` marker; fixed
  `brief.md` §3.2 Fee Rules.
- 2026-09-13: USER DECISION — `discount` is the **fee percentage**
  (debit_card → "2", credit_card → "4", stored as string), not a fee amount.
  `total` = `subtotal × (1 − discount/100)`. `brief.md` was corrected accordingly.

## Recorded Facts

- TODO-06 is **runtime-complete** on `feat/transactions-endpoint`:
  Cycle A (`d12676f`, docs `9ed4ca7`/`8133d5a`) + Cycle B (`2416915`
  `1b73935` `271c94b` `35d314d` `6e709f9`, 4.4 docs incl. this step) —
  the §2.1 error table is fully effective and partial-failure
  compensation ships; the error contract is now testable (TODO-07).
  The §Task 2 `[DONE]` mark, the TODO rename/archive, the merge to
  `main` and the push are **open workflow mechanics only** — nothing was
  renamed or archived by this docs step.
- TODO-05 is complete: all 5 §Task `[DONE]`, archived as
  `20260913-todo-5-DONE.md`, merged to `main` (`5cf97ef`), pushed to
  `origin`. Feature branch `feat/transaction-orchestration` deleted
  post-merge. `TRANSACTIONS_RETURN_BODY` now has its first runtime
  consumer (`TransactionsService`).
- TODO-04 is complete: all 3 tasks `[DONE]`, file archived as
  `20260913-todo-4-DONE.md`, merged to `main` (`f0a979a`) and pushed to
  `origin`; `feat/external-clients` deleted (step 8 of this cycle).
- TODO-03 is complete: all tasks `[DONE]`, merged to `main`, pushed to
  `origin`. Feature branch `feat/transaction-dtos` deleted post-merge.
  (TODO-02 likewise closed earlier — merged to `main` at `d5abceb`, pushed.)
- Flagged user-owned accepted deviations: (a) `30001` in
  `health.controller.ts` curl JSDoc — pre-existing user typo, not workflow
  scope; (b) `docker:*` scripts in `package.json` — pre-existing user edit;
  per the explicit user decision ("commit all current changes and untracked
  files") committed in `03689fd` with content otherwise kept exactly as the
  user wrote it (`docker:ms-logs` → `docker:logs` rename).

- The Numerator mock (`numerator-api/numerator.js`) starts at value **3**; the
  json-server seed (`config/db.json`) already holds ids "1"–"3" for both
  `transactions` and `receivables`, so the next generated IDs will be "4", "5", …
- json-server conventions: string ids, string numeric values (e.g. `"340.50"`),
  masked card numbers (last 4 digits), receivable fields `status`, `create_date`,
  `subtotal`, `discount`, `total`, `transaction_id`.
- Known discrepancy: the `README.md` receivable example (subtotal "250",
  discount "10", total "240") reads as an amount and contradicts the adopted
  percentage interpretation (which would yield "240" only for a 4% fee of
  subtotal 250 → total "240"). The USER DECISION above prevails: treat
  `discount` as a percentage. The README example is superseded.

## Immediate Next Steps

1. **TODO-06 — workflow mechanics ONLY (no code work remains).** Both
   cycles are runtime-complete on `feat/transactions-endpoint` (§Task 1 +
   §Task 3 marked `[DONE]` at `8133d5a`; §Task 2 implemented in
   `2416915`/`1b73935`/`271c94b` + review-fix `35d314d` + simplify
   `6e709f9` + this 4.4 docs step). Remaining Critical-Workflow steps for
   the CALLER, in order: 4.5 verification → 4.6 §Task 2 `[DONE]` → step 5
   (rename `.agent/todos/20260913/20260913-todo-6.md` → `-DONE`, merge
   `feat/transactions-endpoint` to `main`, push to `origin` ONLY). No
   other TODO should start until this thread closes (user-picked order).
2. **TODO-07 — test cycle (NEXT RUNTIME WORK, user's pick):** unit tests
   first (pure `fee-rules.ts` ⇒ no DI; `TransactionsService` with mocked
   clients — verify the 9-step order, gate both `TRANSACTIONS_RETURN_BODY`
   states, masking call-site) + **the Cycle-B error contract it explicitly
   deferred**: filter mapping rows (503/502/500 + verbatim messages, the
   `ERROR-SANITY-OK` temp-script scenarios are the ready-made test list),
   the compensation loop (404=success, exhaustion → one `logger.error`,
   original-error rethrow) incl. the receivable-only-failure 502 path
   which §"Error handling & compensation" documents as non-forceable via
   config; then e2e against the live `POST /v1/transactions` — the full
   structured error contract IS LIVE and stable to test now;
   `passWithNoTests` keeps the suite green until then.

The backlog files `.agent/todos/20260913/20260913-todo-{5,6,7}.md` are now
**TRACKED** user-owned future work (committed at the user's explicit
instruction `03689fd`; contents not interpreted by this workflow).
