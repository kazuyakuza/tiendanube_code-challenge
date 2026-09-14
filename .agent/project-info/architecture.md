# Architecture — Orchestration API (PLANNED)

> STATUS: **core layers implemented — see the dated updates below**
> (through the 2026-09-14 Task 3 entry). This document originally described
> the target design that follows `brief.md` §6; its "src/ is empty" framing
> is superseded — `config/`, `common/` (guards/decorators/enums/constants/
> utils), `health/`, `transactions/dto/` (contract-only), `numerator/` and
> `json-server/` now exist — while the remaining sections stand as target
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
> performs zero outbound HTTP calls today, but because NO orchestration/
> endpoint calls the clients, which now DO boot.)* The "Concurrency Strategy"
> section below was reconciled to the implemented numbers per decision
> T1-D6 (TODO governs: 10 attempts / 20 ms base / domain error classes —
> the original 5 / 50 ms / direct-503 draft is superseded; HTTP mapping is
> the orchestration TODO's job, global plan G18). Details:
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
> controllers, fees, masking, tests are later TODOs). Details:
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
> other service") is satisfied; the future Transactions module just adds the
> module to its own `imports`. Still **NOT** implemented: controller /
> orchestration endpoint, fee calculation, masking call-site and tests — the
> running app therefore still performs zero outbound HTTP calls. Details:
> `docs/app-setup.md` ("External clients (TODO-04)" → "Wiring status") +
> commit `7a4a149`.

## Modular NestJS Layout (target)

```text
src/
├── config/                 # Validated environment config (implemented, T2)
│   ├── config.keys.ts      # ConfigKeys: canonical env key names for ConfigService
│   └── env.validation.ts   # class-validator schema + fail-fast validateEnv()
├── common/                 # Cross-cutting concerns (guards/decorators implemented, T5; enums/constants/utils implemented, TODO-03)
│   ├── api-key.constants.ts # API_KEY_HEADER + Swagger scheme name (implemented, T5)
│   ├── constants/          # payment-fee.constants.ts — fee percent strings "2"/"4" (implemented, TODO-03) + http-timeout.constants.ts — shared `HTTP_TIMEOUT_MS = 4000` for both client modules (implemented, TODO-04 Task 3)
│   ├── decorators/         # public.decorator.ts — @Public() + IS_PUBLIC_KEY (implemented, T5)
│   ├── enums/              # payment-method.enum.ts + receivable-status.enum.ts — string wire values (implemented, TODO-03)
│   ├── guards/             # api-key.guard.ts — global ApiKeyGuard, exact x-api-key match, 401 on missing/wrong (implemented, T5; registered via APP_GUARD from @nestjs/core)
│   ├── filters/            # Global exception filter (structured errors) — planned
│   ├── interceptors/       # Logging/response conventions — planned
│   └── utils/              # card-number.util.ts — pure maskCardNumber last-4 helper (implemented, TODO-03; no runtime caller until TODO-04)
├── health/                 # HEAD /health/ping — public liveness probe (implemented, T4; @Public()-exempt since T5)
├── transactions/           # Main orchestration module — contract layer only so far (TODO-03)
│   ├── dto/                # CreateTransactionDto + validators/ + 3 response DTOs incl. { transaction, receivable } envelope (implemented, TODO-03; not reachable from any route yet)
│   ├── transactions.controller.ts # planned (TODO-04)
│   ├── transactions.service.ts    # planned (TODO-04; first caller of maskCardNumber + fee constants)
│   └── fee-rules.ts        # debit/credit fee map + date/status policy — planned; percentages in common/constants/ meanwhile
├── numerator/              # Numerator API client + CAS retry logic — IMPLEMENTED, TODO-04 Task 1 (getNextId; constants/errors/interfaces) — module uses per-module HttpModule.register({ timeout }) and IS registered in app.module.ts (Task 3)
├── json-server/            # json-server persistence client — IMPLEMENTED, TODO-04 Task 2 (createTransaction/createReceivable transport-only POSTs; constants/errors/interfaces) — module uses per-module HttpModule.register({ timeout }) and IS registered in app.module.ts (Task 3)
├── main.ts                 # Bootstrap: helmet, CORS, morgan, versioning, Swagger (API-Key scheme since T5)
└── app.module.ts           # Wires all modules + global APP_GUARD (ApiKeyGuard, T5)
```

## Request Data Flow — POST /v1/transactions

1. **Guard**: `ApiKeyGuard` validates `x-api-key` (health stays public).
2. **Validation**: DTO pipes validate payload (value, description, method,
   cardNumber, cardHolderName, cardExpirationDate MM/YY, cardCvv).
   *Status (TODO-03): partially live — the validation classes exist and
   compile, but there is **no route yet**, so no request ever reaches them;
   steps 1–7 run as a flow only once TODO-04 registers the controller.*
3. **ID reservation**: `NumeratorService` obtains TWO unique IDs via
   `PUT /numerator/test-and-set` BEFORE any write (no orphan records).
4. **Create transaction**: `JsonServerService` POSTs to `json-server/transactions`
   with the first ID; card number masked to last 4 digits.
5. **Compute receivable**: fee rules → status, payment date, subtotal, discount
   (percentage string), total.
6. **Create receivable**: POST to `json-server/receivables` with the second ID.
7. **Respond**: 201 with both resources in one consistent body.

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
     **503**) belongs to the orchestration TODO (global-plan G18) — the
     "503 structured error" phrase in step 4 above and in "Error & Response
     Conventions" is target design, not client behavior.
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
- CAS exhaustion / upstream failure → 503 with structured body.
- Unknown routes → 404 structured body.
- No stack traces in responses when `NODE_ENV=production`.

## Observability

- `morgan` HTTP logging middleware for every incoming request.
- Swagger UI at `/docs` (all DTOs annotated with `@ApiProperty`).
