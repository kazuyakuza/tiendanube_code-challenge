# Architecture — Orchestration API (PLANNED)

> STATUS: **core layers, first business route and the full error contract
> implemented — see the dated updates below** (through the 2026-09-14
> TODO-06 **Cycle B** entry — `POST /v1/transactions` LIVE via
> `TransactionsController`, the `AllExceptionsFilter` global error→HTTP
> mapping LIVE and partial-failure compensation LIVE; tests deferred to
> TODO-07). This document
> originally described
> the target design that follows `brief.md` §6; its "src/ is empty" framing
> is superseded — `config/`, `common/` (guards/decorators/enums/constants/
> utils), `health/`, `transactions/dto/` + the `transactions/`
> controller/module/service/fee-rules stack (TODO-05 service + TODO-06
> Cycle A controller,
> `numerator/` and `json-server/` now exist — while the remaining sections stand as target
> design until their dated entries land. Update after implementation.
>
> 2026-09-13 update (TODO-02 T1): §1-level project-root configs
> (`package.json`, tsconfig/eslint/jest, `nest-cli.json`, `.env.example`) plus
> the minimal `src/main.ts` + `src/app.module.ts` scaffold now exist; the
> `src/`-empty note above is superseded by that skeleton only — every module
> and pattern described below remains planned, not yet implemented.
>
> 2026-09-13 update (TODO-02 T2): the `src/config/` block below is now
> **implemented** and differs from the original plan: it ships as
> `env.validation.ts` (class-validator schema + `validateEnv()`, consumed by
> `ConfigModule.forRoot({ isGlobal, cache, validate })` in `app.module.ts`;
> startup aborts fail-fast on missing/invalid vars, and env URLs must include
> a protocol per plan addendum A4-R) plus `config.keys.ts` (`ConfigKeys` —
> the canonical key names all `ConfigService` consumers must use). The planned
> `configuration.ts` was intentionally NOT created (T2 decision A8: no
> consumer yet; add it only if a later TODO requires it), and the planned
> `validation.ts` shipped under the TODO-mandated name `env.validation.ts`.
> Later tasks must stay consistent with these names. Everything else below
> remains planned.
>
> 2026-09-13 update (TODO-02 T3): the `main.ts` "Bootstrap" concern is now
> **implemented** — security/logging/validation/versioning/docs, all
> env-driven: helmet defaults on every response; CORS via `CORS_ORIGINS`
> (CSV allowlist, absent/blank ⇒ allow-all dev default); morgan with a
> `NODE_ENV`-conditional format (`dev` in development, `combined` otherwise,
> incl. the 404s of this stage); global `ValidationPipe`
> (whitelist/forbidNonWhitelisted/transform); URI versioning
> `defaultVersion: '1'` with **no** `setGlobalPrefix` (this supersedes the
> "`setGlobalPrefix` + `enableVersioning`" phrase in the "API Versioning"
> section, whose text stands as original planning); Swagger UI at `/docs`,
> gated by `SWAGGER_ENABLED` (absent ⇒ enabled); listen PORT read through the
> validated `ConfigService` (A3-R: required keys via `getOrThrow`,
> `SWAGGER_ENABLED` via `get(key, default)`). No exception filters or
> interceptors exist yet, no route is served besides `/docs`, and health (§
> "HEAD /health/ping") plus the API-key guard remain **planned**; their code
> lives in `common/` + `health/` per the layout below, which T4/T5 will
> create. Details: `docs/app-setup.md` ("API behavior at this stage").
>
> 2026-09-13 update (TODO-02 T4): the `health/` block is now **implemented**
> as designed — `src/health/health.module.ts` + `health.controller.ts` serve
> `HEAD /health/ping` with `200 OK` and an empty body. Unversioning mechanism
> (supersedes both the "`@SkipVersioncheck()`" phrase of global-plan G8 and
> the T3 note above): `version: VERSION_NEUTRAL` set on the
> `@Controller({...})` metadata itself (decision G8-R — the installed
> NestJS 11.2.3 exposes no `@SkipVersioncheck()`), so `main.ts` needed no
> health-specific code. Swagger lists the probe as a `head` operation
> (deliberate, T4 decision C). It is public **only because no guard exists
> yet**: T5 registers the global API-key guard and must exempt this route
> with `@Public()` (see "Security" below — still planned). Details:
> `docs/app-setup.md`. *(For T5 superseding this paragraph's "guard
> planned" state, see the T5 update below.)*
>
> 2026-09-13 update (TODO-02 T5): the **Security** §guard is now
> **implemented** per this design ("Security" below is live, not planned):
> `ApiKeyGuard` (`src/common/guards/api-key.guard.ts`) registered globally in
> `app.module.ts` via the `APP_GUARD` token — note: the token is exported by
> `@nestjs/core`, not `@nestjs/common` (plan-code correction recorded in T5
> plan §6). Missing/wrong `x-api-key` → **401**
> `UnauthorizedException('Missing or invalid x-api-key header')`; exact
> string compare vs `API_KEY` (global-plan G9 rationale; a guard
> `return false` would wrongly produce 403). `HEAD /health/ping` is exempted
> by method-level `@Public()` (`src/common/decorators/public.decorator.ts`,
> shared `IS_PUBLIC_KEY` read via `Reflector.getAllAndOverride`). Swagger
> exposes the `API-Key` apiKey scheme (header `x-api-key`, constants in
> `src/common/api-key.constants.ts`) plus a document-level security
> requirement, so the Authorize button works (D10: padlock on the public
> probe is cosmetic). No placeholder protected route is committed (G10 —
> verification used a throwaway route, T5 plan §10). `common/filters/` and
> `common/interceptors/` remain **planned**; the first real `/v1` protected
> routes arrive in later TODOs. Details: `docs/app-setup.md`.
>
> 2026-09-13 update (TODO-03, cycle TD): the `transactions/dto/` block is
> now **implemented as contract-only** — `CreateTransactionDto` (+ custom
> validators in `dto/validators/`), `TransactionResponseDto`,
> `ReceivableResponseDto` and the `CreateTransactionResponseDto` envelope
> compile but the Nest module/controller/service do **not** exist, so
> `POST /v1/transactions` is still not reachable and Swagger `/docs` still
> lists only the health probe (the DTOs render once TODO-04 wires the
> endpoint). Under `common/`, `enums/` (PaymentMethod, ReceivableStatus),
> `constants/` (payment-fee "2"/"4" percent strings) and `utils/`
> (`maskCardNumber`, last 4) are now implemented; `fee-rules.ts` remains
> planned — its fee percentages currently live in the constants file. In
> "Request Data Flow" below, **step 2 is partially live**: the validation
> classes exist but nothing executes them. `TRANSACTIONS_RETURN_BODY`
> (§2.4) has validated plumbing (env schema + `ConfigKeys` +
> `.env.example`), no runtime consumer until the TODO-04 controller.
> *(2026-09-14 supersessions per the TODO-05 entry below: the module/service
> + `fee-rules.ts` now **exist**, and `TRANSACTIONS_RETURN_BODY`'s first
> runtime consumer is `TransactionsService`; the endpoint/controller — and
> thus any HTTP-observable gate effect — remain pending a later TODO). *
> Details: `docs/app-setup.md` ("DTO & validation layer").
>
> 2026-09-13 update (TODO-04 Task 1): the `numerator/` block is now
> **implemented** — `src/numerator/` ships `NumeratorService.getNextId()`
> (bounded CAS retry loop: every attempt re-reads the current value via
> `GET /numerator`; ONLY genuine conflicts retry — HTTP 400 whose body
> carries a numeric `currentNumerator`, global plan G5; light exponential
> backoff, 20 ms base capped at 160 ms; domain errors
> `NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` /
> `InvalidNumeratorValueError`), plus `numerator.constants.ts`, `errors/`,
> `interfaces/` and a minimal `NumeratorModule` (decision T1-D1).
> `NUMERATOR_API_URL` has its first consumer; the optional
> `MAX_RETRIES` / `NUMERATOR_BASE_BACKOFF_MS` knobs are validated with
> in-code defaults. **Still pending (Tasks 2–3):** `json-server/` does not
> exist, `NumeratorModule` is NOT yet imported in `AppModule`, and the
> `HttpModule` import is bare — Task 3 registers both modules and upgrades
> to the timeout-configured `HttpModule.register` form (there is NO
> `forRoot` in `@nestjs/axios` v4 — decision T1-D7); until then the running
> app performs **zero outbound HTTP calls**. *(2026-09-14 supersessions: the
> Task 2 update below implements the `json-server/` block, and the Task 3
> update below registers both modules with the timeout-configured
> `HttpModule.register` import — this entry's "Still pending (Tasks 2–3)",
> bare-`HttpModule` and not-yet-imported statements are stale. The app still
> performs zero outbound HTTP calls today, but because nothing ever reaches
> the orchestration code that would call the clients (the clients themselves
> DO boot — since 2026-09-14 TODO-05 that caller exists as `TransactionsService`).)* The "Concurrency Strategy"
> section below was reconciled to the implemented numbers per decision
> T1-D6 (TODO governs: 10 attempts / 20 ms base / domain error classes —
> the original 5 / 50 ms / direct-503 draft is superseded; HTTP mapping is
> the pending **controller** TODO's job, global plan G18 —
> `TransactionsService` (TODO-05) deliberately propagates these errors raw). Details:
> `docs/app-setup.md` ("External clients (TODO-04)").
>
> 2026-09-14 update (TODO-04 Task 2): the `json-server/` block is now
> **implemented** — `src/json-server/` ships `JsonServerService`'s
> `createTransaction` / `createReceivable` (TODO §2.1–§2.3: `@nestjs/axios`
> POSTs to `{JSON_SERVER_URL}/transactions` and `/receivables`, returning
> the echoed resource body; json-server's 201 is NOT asserted — any
> resolved response succeeds, decision T2-D3) under a **transport-only
> contract** (§2.4): ids, masked card numbers, fee percentages, totals and
> `create_date` are caller-supplied and never computed or defaulted here.
> Failure model: fail-fast (a json-server retry policy is explicitly out of
> scope — TODO §Out of scope), one domain error
> `JsonServerRequestError` carrying `resource` + `status` + payload-free
> `reason`, where `status: number | undefined` is `undefined` on
> network/timeout/non-axios failures; neither messages nor logs ever
> include payloads or upstream bodies (card-data privacy, §Configuration &
> resilience; decision T2-D7). The base URL is `JSON_SERVER_URL` via
> `ConfigService.getOrThrow` read at construction, trailing slashes
> normalized once (decision T2-D1) — **no new env key**. Interfaces for the
> two §2.4 transport payloads plus 2-params-rule param objects (G10), the
> two resource-path constants, and a minimal `JsonServerModule` importing
> the **bare `HttpModule`** await registration: **still pending (Task 3)**
> — `HttpModule.register({ timeout })` + `AppModule` import both clients
> (G12/G14, T1-D7), and neither service instance boots until then. *(State
> superseded by the 2026-09-14 Task 3 update below: both modules now import
> `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` and are registered in
> `AppModule`; services construct at boot, while outbound HTTP stays at zero
> for lack of any calling endpoint.)* Steps
> 3–7 of "Request Data Flow" below remain target design (orchestration,
> controllers, fees, masking, tests are later TODOs). *(Partially superseded
> by the 2026-09-14 TODO-05 update below: steps 3–6 are now implemented AT
> THE SERVICE LAYER — still uninvoked until a controller exists.)* Details:
> `docs/json-server-client.md` + `docs/app-setup.md` ("External clients
> (TODO-04)").
>
> 2026-09-14 update (TODO-04 Task 3 — module registration): **both client
> modules are now registered in `AppModule`** (`NumeratorModule` +
> `JsonServerModule`, G14), each importing
> `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` — the shared constant
> `HTTP_TIMEOUT_MS = 4000` lives in
> `src/common/constants/http-timeout.constants.ts` (G12; v4 has no `forRoot`
> — decisions T1-D7/T3-D1, so the config lives in the feature modules, not a
> root registration). `register` gives **each module its own isolated,
> pre-configured axios instance** (T3-D2): the two clients never share one
> global instance. Both services export and now construct at boot (config
> reads only) and are injectable app-wide — the TODO's closing guidance ("a
> developer can inject `NumeratorService` / `JsonServerService` into any
> other service") is satisfied; the (now existing, since TODO-05 below)
> Transactions module adds the modules to its own `imports`. What this
> entry still excluded — controller, endpoint, fee calculation and masking
> call-site — has since partially landed: the service + fee + masking are
> implemented (see TODO-05 update below); the **controller/endpoint and tests
> are still not implemented**, so the running app still performs zero outbound
> HTTP calls. *(2026-09-14 TODO-06 Cycle A supersedes the final clause: the
> controller/endpoint now exists — boot remains config-reads-only, and
> outbound HTTP happens exactly while `POST /v1/transactions` is invoked;
> tests remain a deferred TODO.)* Details:
> `docs/app-setup.md` ("External clients (TODO-04)" → "Wiring status") +
> commit `7a4a149`.
>
> 2026-09-14 update (TODO-05 — transaction orchestration service): the first
> business layer is **implemented as a service only** — no controller, no
> endpoint, no route (TODO §Out of scope; user-ratified). Three new files in
> `src/transactions/` + the `AppModule` import + `app.module.ts` header-JSDoc
> refresh: `fee-rules.ts` (pure: `resolveReceivableStatus`, `computeTotal`,
> `formatDateDDMMYYYY`), `transactions.service.ts` (`TransactionsService.create(dto)` —
> the strict 9-step flow: two `getNextId()` reservations before any write
> (zero orphans), masking on the write path via `maskCardNumber`, fee data
> (discount = fee-% string from `PAYMENT_FEE_PERCENTAGES`; status =
> `paid`/`waiting_funds`; `total` = integer-cents math **truncated** to 2
> decimals `floor(cents × remaining% / 100)` — worked examples incl.
> `"10.01"`@4→`"9.60"`, `"0.01"`@2→`"0.00"`; strict transaction→receivable
> persistence order; envelope-or-`undefined` return gated by
> `ConfigKeys.TransactionsReturnBody` via `get(key, true)`; **zero try/catch**
> — Numerator domain errors / `JsonServerRequestError` propagate raw, a
> failed second write ⇒ accepted partial state — TODO §Error), and
> `transactions.module.ts` (imports the two registered client modules,
> provides + exports the service, **no controller**). **Payment ruling (user,
> Option B, 2026-09-14): there is NO `payment_date` field and NO D+30
> date math anywhere** — D+0/D+30 settlement is carried purely by `status`,
> `create_date` = local now `DD/MM/YYYY` (supersedes TODO §Fee's payment-date
> phrasing; impl plan §8 D1). Steps 3–6 of "Request Data Flow" below are thus
> **implemented at the service layer — still uninvoked** (no HTTP path); step
> 7's 201 stays with the controller TODO. **First consumers activated at the
> service layer only:** `maskCardNumber` (was uncalled since TODO-03),
> `PAYMENT_FEE_PERCENTAGES` and the shared enums via `fee-rules.ts`, and
> `TRANSACTIONS_RETURN_BODY` (was §2.4 plumbing-only since TODO-03) — while
> externally the app is STILL health-only routes/404s with zero outbound HTTP
> (verification = build+lint exit 0; no tests, no live traffic — the route
> must not be assumed until the controller TODO wires it). *(2026-09-14
> TODO-06 Cycle A supersedes: `POST /v1/transactions` is LIVE — steps 3–6
> are now invoked over HTTP and step 7's route-level 201 exists; the
> "zero outbound HTTP" static property ended — it happens only while the
> route runs.)* **Workflow notes:**
> the five `## Task` sections + wiring ran as **ONE merged 4.1–4.6 cycle**
> (inseparable facets of the single `TransactionsService.create` deliverable
> — workflow's "extremely short/related" clause, user-ratified, not five
> independent expansions); **T5-G13 froze the client/transport interfaces —
> zero edits under `src/json-server/`/`src/numerator/` and DTO field shapes
> unchanged**; the envelope returns `| undefined` (impl plan §3, T5-G6
> widening — D3 on the §8 deviation table). The cycle's numbered file handle
> is `20260913-todo-5.md` → **TODO-05** (its internal "TODO 04" title = the
> orchestration task; external clients = todo-4 — docs now prefer naming
> artifacts over numbers). Details: `docs/app-setup.md` ("Transactions
> orchestration service (TODO-05)") + git `207f79c` `759bb62` `7b2176c`.
>
> 2026-09-14 update (TODO-06 Cycle A — transactions endpoint): the first
> business route is **implemented** — new
> `src/transactions/transactions.controller.ts` (thin G3 controller:
> `@Controller('transactions')` + single `@Post()` one-line handler
> relaying `TransactionsService.create(dto)`), registered as
> `controllers: [TransactionsController]` in `TransactionsModule`
> (`AppModule` import pre-existing) — commit `d12676f`, branch
> `feat/transactions-endpoint`, v`0.5.0` (plans
> `.kilo/plans/20260914-transactions-endpoint.md` §4 +
> `.kilo/plans/20260914-transactions-controller.md` CA-D1…CA-D8).
> Mechanics: **G1** auth = the existing global `APP_GUARD` `ApiKeyGuard`
> only — NO `@UseGuards`/`@Public()` on the controller, so missing/wrong
> `x-api-key` → **401** is now observable on a real route; global
> `ValidationPipe` → **400** on invalid payloads; **G2** the
> `TRANSACTIONS_RETURN_BODY` gate stays SERVICE-level and the controller
> returns the service result directly — envelope ⇒ **201 + body**,
> `undefined` ⇒ **bare 201** with empty body (`@HttpCode(201)` + Express
> adapter nil-body send, verified against installed sources +
> `HealthController.ping()` precedent); **G6/CA-D1/D2/D3** Swagger renders
> the operation with the legacy decorator set (verified non-deprecated in
> installed `@nestjs/swagger` 11.4.7) plus `@ApiBadGateway` +
> `@ApiInternalServerError`, mounted `/v1/transactions` via the global
> `defaultVersion: '1'` (no version metadata), inheriting the
> document-level `x-api-key` security requirement (no `@ApiSecurity`).
> **Request Data Flow below: steps 1–2 are now end-to-end LIVE on the
> route** and step 7's route-level 201 (envelope / bare) is LIVE — those
> status lines were updated in place. **TRUTH BOUNDARY — TODO-06 Cycle B
> is pending:** the `APP_FILTER` global exception filter (G4), the
> structured 502/503/500 mapping and the partial-failure compensation (G5)
> are **not implemented**; domain errors propagate through the live route
> and surface as the **NestJS default 500** (TODO §2.1 error table NOT
> fully effective; a failed second write still leaves an orphan
> transaction). "Error & Response Conventions" below and `common/filters/`
> therefore remain **planned**. *(2026-09-14 TODO-06 **Cycle B** supersedes
> this entry's whole TRUTH BOUNDARY: filter, mapping and compensation are
> LIVE — see the Cycle-B entry below.)* Zero src changes beyond controller +
> module wiring (G7); the frozen files' stale "no controller / route 404s
> / zero outbound / bare-201 awaits the controller" JSDoc got a
> comment-only truth sweep in this cycle's 4.4 docs step. Gates per G9
> (build/lint/test + DI-boot sanity; docker + curl flows are user-run —
> `docs/app-setup.md` → "Transactions endpoint (TODO-06 Cycle A)").
>
> 2026-09-14 update (TODO-06 Cycle B — error handling & compensation): the
> error contract is **implemented** — this entry supersedes the Cycle-A
> "TRUTH BOUNDARY" and makes the §2.1 error table fully effective.
> `2416915` added `src/common/filters/all-exceptions.filter.ts` — ONE
> catch-all `@Catch()` class (CB-D1) registered via `APP_FILTER` from
> `@nestjs/core` in `app.module.ts` — answering every unhandled exception
> with the structured `{ statusCode, message, error }` body: HttpExceptions
> (guard **401**, ValidationPipe **400** — the `message` STRING ARRAY passes
> through unmodified, CB-D2a pass-through regression verified by the cycle's
> temp `ERROR-SANITY-OK` in-process script, G10 404 re-emission included)
> re-emit with their own status/shape; Numerator domain errors → **503**;
> `JsonServerRequestError` → **503** on unknown/≥500 upstream status,
> **502** on 4xx (decision: 502 over the "or 500" alternative — an upstream
> contract anomaly behind this gateway, truthful for clients and consistent
> with Cycle A's `@ApiBadGatewayResponse`); domain messages pass **verbatim**
> (payload-safe by construction, CB-D2b). Unknown errors: generic 500 body
> in EVERY environment + server-side `Logger.error` with stack — the
> production no-leak rule holds **by construction**, the filter reads no
> ConfigService/NODE_ENV at all (CB-D3 log-only; the §"Error & Response
> Conventions" note below is now implemented reality). `1b73935` added
> partial-failure compensation (G5): `transaction-compensation.service.ts`
> (`TransactionCompensationService.deleteTransaction` — bounded DELETE loop
> on `{JSON_SERVER_URL}/transactions/:id`: `COMPENSATION_MAX_ATTEMPTS = 3`,
> backoff `min(200 × 2^(n−1), 1600)` ms between attempts,
> `src/common/constants/compensation.constants.ts`; 404 = already-gone =
> success CB-D4a; **never throws** — returns `true`/`false`) + the
> TransactionsModule's own isolated `HttpModule.register({ timeout })`
> (CB-D5, T3-D2 precedent; `src/json-server/` kept ZERO diffs, G7 — only
> its resource-path constant is imported) + the pipeline's ONLY try/catch
> in `TransactionsService.create()`, wrapping exactly `createReceivable`
> and catching ANY error (CB-D6 — at that point the row exists), awaiting
> compensation then **rethrowing the ORIGINAL error** for the untouched
> §2.1 mapping; a surviving orphan logs ONE `logger.error` ids+reason line
> (privacy G5/T2-D7). Honest scope: orphans **reduced, not eliminated**
> (§2.2 — no saga/circuit breaker; knobs are in-code constants, no new env
> keys G7). `271c94b` shipped the controller Swagger/JSDoc truth fix
> (CB-D7); `35d314d` (4.3 review) extracted the single-section boolean
> helpers (`isNumeratorError`/`isUpstreamFailure`; recorded deviation: the
> reviewer used a TS type-predicate return, beyond the plan snippet, to
> keep `resolveDomainBody` narrowing compilable); `6e709f9` (4.3
> simplify) hoisted the compensation reason computation + swept a stale
> comment. The Cycle-A 4.4 JSDoc sweep precedent + the docs-specialist
> role justified the comment-only pointer flips in the G7-frozen client
> package headers (`numerator(.errors|.service)`, `json-server.errors`).
> Gates per G9: build/lint/test exit 0 + temp `tmp-error-sanity.js`
> direct-filter assertions (`ERROR-SANITY-OK`, deleted, never committed);
> docker/curl fault-injection flows are user-run recipes now in
> `docs/app-setup.md` → "Error handling & compensation (TODO-06 Cycle B)"
> (the 502/compensation-only path is honestly deferred to TODO-07 tests).

## Modular NestJS Layout (target)

```text
src/
├── config/                 # Validated environment config (implemented, T2)
│   ├── config.keys.ts      # ConfigKeys: canonical env key names for ConfigService
│   └── env.validation.ts   # class-validator schema + fail-fast validateEnv()
├── common/                 # Cross-cutting concerns (guards/decorators implemented, T5; enums/constants/utils implemented, TODO-03)
│   ├── api-key.constants.ts # API_KEY_HEADER + Swagger scheme name (implemented, T5)
│   ├── constants/          # payment-fee.constants.ts — fee percent strings "2"/"4" (implemented, TODO-03) + http-timeout.constants.ts — shared `HTTP_TIMEOUT_MS = 4000` for both client modules (implemented, TODO-04 Task 3) + compensation.constants.ts — orphan-DELETE retry knobs 3 attempts / 200 ms base / 1600 ms cap (implemented, TODO-06 Cycle B)
│   ├── decorators/         # public.decorator.ts — @Public() + IS_PUBLIC_KEY (implemented, T5)
│   ├── enums/              # payment-method.enum.ts + receivable-status.enum.ts — string wire values (implemented, TODO-03)
│   ├── guards/             # api-key.guard.ts — global ApiKeyGuard, exact x-api-key match, 401 on missing/wrong (implemented, T5; registered via APP_GUARD from @nestjs/core)
│   ├── filters/            # all-exceptions.filter.ts — global `AllExceptionsFilter`: structured `{statusCode,message,error}`, §2.1 mapping, HttpException pass-through, generic-500 log-only rule (implemented, TODO-06 Cycle B; registered via APP_FILTER from @nestjs/core)
│   ├── interceptors/       # Logging/response conventions — planned
│   └── utils/              # card-number.util.ts — pure maskCardNumber last-4 helper (implemented, TODO-03; runtime call-site wired in TODO-05's service — HTTP-triggered since TODO-06 Cycle A via POST /v1/transactions)
├── health/                 # HEAD /health/ping — public liveness probe (implemented, T4; @Public()-exempt since T5)
├── transactions/           # Main orchestration module — controller + route LIVE (TODO-06 Cycle A: POST /v1/transactions — guard 401, ValidationPipe 400, 201 envelope / bare 201 via the service gate; domain errors → structured 502/503 via the global filter) + orphan-DELETE compensation LIVE (TODO-06 Cycle B); tests pending (TODO-07)
│   ├── dto/                # CreateTransactionDto + validators/ + 3 response DTOs incl. { transaction, receivable } envelope (implemented, TODO-03; consumed by TransactionsService since TODO-05; reachable + Swagger-rendered via POST /v1/transactions since TODO-06 Cycle A)
│   ├── transactions.controller.ts # implemented (TODO-06 Cycle A, commit d12676f): thin POST /v1/transactions handler — auth via the global APP_GUARD (no @UseGuards/@Public()), 201 envelope/bare-201 relayed from the service gate, full Swagger (legacy set + 502/500); error→HTTP mapping LIVE via the Cycle-B `AllExceptionsFilter` (G4)
│   ├── transactions.service.ts    # implemented (TODO-05): create() 9-step orchestration; first caller of maskCardNumber + fee constants; injectable + exported by TransactionsModule; invoked over HTTP by TransactionsController since TODO-06 Cycle A; since Cycle B its ONE try/catch wraps createReceivable → compensates the orphan → rethrows the ORIGINAL error
│   ├── transaction-compensation.service.ts # implemented (TODO-06 Cycle B, commit 1b73935): TransactionCompensationService.deleteTransaction — bounded orphan-DELETE retry loop (3 attempts, min(200×2^n,1600) ms backoff, 404=success, NEVER throws); provided-only (not exported) by TransactionsModule
│   ├── transactions.module.ts     # implemented (TODO-05): imports NumeratorModule + JsonServerModule, provides/exports TransactionsService; registers TransactionsController since TODO-06 Cycle A; since Cycle B also its own HttpModule.register({ timeout }) + provider TransactionCompensationService; registered in app.module.ts
│   └── fee-rules.ts        # implemented (TODO-05): pure resolveReceivableStatus/computeTotal/formatDateDDMMYYYY — fee percentages stay in common/constants/ (read via PAYMENT_FEE_PERCENTAGES, never re-declared); NO D+30 add-days math (Option-B ruling)
├── numerator/              # Numerator API client + CAS retry logic — IMPLEMENTED, TODO-04 Task 1 (getNextId; constants/errors/interfaces) — module uses per-module HttpModule.register({ timeout }) and IS registered in app.module.ts (Task 3)
├── json-server/            # json-server persistence client — IMPLEMENTED, TODO-04 Task 2 (createTransaction/createReceivable transport-only POSTs; constants/errors/interfaces) — module uses per-module HttpModule.register({ timeout }) and IS registered in app.module.ts (Task 3)
├── main.ts                 # Bootstrap: helmet, CORS, morgan, versioning, Swagger (API-Key scheme since T5)
└── app.module.ts           # Wires all modules + global APP_GUARD (ApiKeyGuard, T5) + global APP_FILTER (AllExceptionsFilter, TODO-06 Cycle B)
```

## Request Data Flow — POST /v1/transactions

1. **Guard**: `ApiKeyGuard` validates `x-api-key` (health stays public).
   *Status (implemented since T5; LIVE since 2026-09-14 TODO-06 Cycle A):
   the guard runs on MATCHED routes only — `POST /v1/transactions` is now
   a committed, non-`@Public()` matched route, so every request to it is
   key-checked (**401** on missing/wrong `x-api-key` is externally
   observable; since TODO-06 Cycle B the `AllExceptionsFilter` re-emits
   this guard-`HttpException` 401 body VERBATIM — its shape is unchanged
   pass-through); unknown paths still 404 before the guard.*
2. **Validation**: DTO pipes validate payload (value, description, method,
   cardNumber, cardHolderName, cardExpirationDate MM/YY, cardCvv).
   *Status (TODO-03 classes; LIVE since TODO-06 Cycle A):
   `TransactionsController` binds `CreateTransactionDto`, so the global
   ValidationPipe now answers **400** on every invalid request — steps 1–2
   run end-to-end over HTTP and only then is the `create()` orchestration
   below invoked.*
3. **ID reservation**: `NumeratorService` obtains TWO unique IDs via
   `PUT /numerator/test-and-set` BEFORE any write (no orphan records).
   *Status (TODO-05): **implemented at the service layer** —
   `TransactionsService` reserves both ids before any `create*` (both before
    any write — no orphans if the SECOND reservation fails). Invoked over
    HTTP on every `POST /v1/transactions` since TODO-06 Cycle A.*
4. **Create transaction**: `JsonServerService` POSTs to `json-server/transactions`
   with the first ID; card number masked to last 4 digits.
   *Status (TODO-05): implemented at service layer — masking now has its
    runtime call-site (`buildTransactionPayload` → `maskCardNumber`); the
    HTTP path triggering it is live since TODO-06 Cycle A.*
5. **Compute receivable**: fee rules → status, subtotal, discount
   (percentage string), total; `create_date` = local now `DD/MM/YYYY`.
   *Status (TODO-05): implemented — `resolveReceivableStatus` +
   `PAYMENT_FEE_PERCENTAGES` + cents-truncate `computeTotal`
   (`src/transactions/fee-rules.ts`). Payment-date line is superseded per
   Option B (§dated updates above): NO `payment_date` in the flow.*
 6. **Create receivable**: POST to `json-server/receivables` with the second ID.
    *Status (TODO-05): implemented at service layer with strict
    transaction-then-receivable order. Since TODO-06 Cycle B a failure of
    THIS step alone triggers the orphan-DELETE compensation
    (`TransactionCompensationService`, the service's only try/catch) before
    the original error propagates to the filter.*
7. **Respond**: 201 with both resources in one consistent body (or a bare
   `201` when `TRANSACTIONS_RETURN_BODY=false`).
    *Status (TODO-05; route-level LIVE since TODO-06 Cycle A): `create()`
    returns the envelope or `undefined` per the service-level gate and
     `TransactionsController` relays it — **201 + body, or bare 201
     (empty body), observable today**. Structured error bodies replaced
     Nest's defaults app-wide since TODO-06 Cycle B (G4, LIVE): domain
     failures → 503/502, unknown → generic 500 — every reply is the
     `{ statusCode, message, error }` shape.*

## Concurrency Strategy for ID Generation

- **Chosen mechanism**: `PUT /numerator/test-and-set` (atomic CAS).
  Request body `{ "oldValue": N, "newValue": N+1 }`.
  - Success → returns `newValue`; caller owns ID `newValue`.
  - Failure → HTTP 400 with `{ "error", "currentNumerator" }`; caller retries
    from `currentNumerator`. *(2026-09-13 update, TODO-04 Task 1: the client
    instead re-reads `GET /numerator` each attempt — the body value is
    logging-only; see the as-implemented revision below.)*
- **Algorithm** (per requested ID):
  1. `GET /numerator` → current value N (also returned in the 400 body).
  2. `PUT /numerator/test-and-set { oldValue: N, newValue: N + 1 }`.
  3. On 400: set `N = body.currentNumerator`, retry step 2.
  4. Max attempts (e.g. 5) with short exponential backoff (e.g. 50ms base);
     exhaust → 503 structured error.
- **As-implemented revision (2026-09-13 update, TODO-04 Task 1 — plan
  decision T1-D6, supersedes steps 1/3/4 above as the original planning
  text)**:
  1. Every attempt RE-READS the current value via `GET /numerator`; the 400
     body's `currentNumerator` is used for logging only, never to skip the
     GET (global-plan G6).
  2. Only a GENUINE CAS conflict retries: HTTP 400 whose body carries a
     numeric `currentNumerator` (global-plan G5 discriminator — the mock's
     invalid-params 400 has no such field and must NOT retry).
  3. Budget: `MAX_RETRIES` total attempts, default **10** (not 5). Backoff
     `min(NUMERATOR_BASE_BACKOFF_MS × 2^retryIndex, 160 ms)` with base
     default **20 ms** (not 50 ms); no sleep after the final conflict.
  4. Failures surface as DOMAIN ERROR CLASSES, not HTTP statuses: exhausted
     budget → `NumeratorRetriesExhaustedError`; network/timeout/5xx/
     unexpected 400 → `NumeratorUnavailableError`; non-finite value or
      unsafe candidate → `InvalidNumeratorValueError`. Mapping to HTTP (e.g.
      **503**) belongs to the pending controller TODO (global-plan G18) —
      the service layer (TODO-05) still propagates these raw — so the
      "503 structured error" phrase in step 4 above and in "Error & Response
      Conventions" is target design, not client behavior.
  *(2026-09-14 TODO-06 Cycle B — final supersession of that trailing note:
  G18's owning layer has LANDED — the global `AllExceptionsFilter` maps all
  three Numerator errors to the structured **503**. Still NOT client
  behavior: the client and service keep throwing domain error classes raw;
  only the app-wide filter emits the 503, so the "503 structured error"
  phrase now describes the HTTP surface as implemented.)*
- **Both IDs before insert**: the service reserves ID-A and ID-B first; if the
  second reservation fails, NO insert happens (no orphans).
- **Numeric → string**: json-server requires string ids; convert `newValue`
  with `String(...)` before persistence.
- **Lock endpoints** (`POST/DELETE /numerator/lock`) are NOT used: CAS alone
  satisfies uniqueness with simpler failure handling.

## API Versioning

- URI versioning via NestJS `setGlobalPrefix` + `enableVersioning(TYPE_URI)`.
- Business endpoints under `/v1` (e.g. `POST /v1/transactions`).
- Health probe is unversioned: `HEAD /health/ping`.

## Security

- `helmet` enabled globally.
- CORS enabled (origins configurable via env; defaults permissive for dev).
- `ApiKeyGuard` registered globally; `@Public()` decorator exempts
  `/health/ping`.
- Header: `x-api-key` compared against `API_KEY` env var.
- **Status (T5, 2026-09-13): implemented as listed above.** Global
  registration = `APP_GUARD` provider (`@nestjs/core`) in `app.module.ts`;
  rejection = thrown `UnauthorizedException` → **401** (never `return
  false`, which Nest maps to 403); compare = exact `===` (G9 scope);
  exemption = `IS_PUBLIC_KEY` metadata via `Reflector`. Swagger `API-Key`
  scheme + document-level requirement back the Authorize button (TODO §5.3).
  Runbook and curl examples: `docs/app-setup.md` ("The API key guard").

## Error & Response Conventions

- Global exception filter returns structured JSON:
  `{ "statusCode", "message", "error" }`.
- Validation failures → 422 (Bad Request body shape from DTO messages).
  *(Correction on this original planning line: implemented reality is
  **400** — the ValidationPipe raises Nest's `BadRequestException` — and
  since Cycle B that 400, including its `message` **array**, survives the
  filter as verbatim pass-through.)*
- CAS exhaustion / upstream failure → 503 with structured body.
  *(Unexpected upstream **4xx** → **502** Bad Gateway by decision G4/CB-D2 —
  anomaly behind the gateway, not our fault.)*
- Unknown routes → 404 structured body. *(Honest, as-implemented semantics:
  the filter re-emits `HttpException`s — including Nest's router 404 — with
  their OWN bodies unchanged; those bodies already have the
  `{ statusCode, message, error }` shape (global-plan G10 note), so this
  line is TRUE by pass-through, not by filter rewrites. No route currently
  answers a custom resource-404.)*
- No stack traces in responses when `NODE_ENV=production`. *(Implemented
  stronger: the generic 500 body goes to clients in EVERY environment and
  message+stack is only logged server-side via `Logger.error` — CB-D3
  log-only, leak impossible by construction.)*
- **Status (2026-09-14, TODO-06 Cycle B): IMPLEMENTED — this supersedes
  the former "still target design" note.** `AllExceptionsFilter`
  (`src/common/filters/all-exceptions.filter.ts`) is registered globally
  via `APP_FILTER` (`@nestjs/core`) in `app.module.ts`; §2.1 mapping live
  (Numerator errors → 503; `JsonServerRequestError` → 503 on unknown/≥500,
  502 on 4xx; messages verbatim; guard-401 / pipe-400 / router-404
  pass-through). Receivable-write failures are compensated by the orphan
  DELETE before the ORIGINAL error maps (G5). Full contract table,
  compensation knobs and user-run fault-injection recipes:
  `docs/app-setup.md` → "Error handling & compensation (TODO-06 Cycle B)".

## Observability

- `morgan` HTTP logging middleware for every incoming request.
- Swagger UI at `/docs` (all DTOs annotated with `@ApiProperty`).
