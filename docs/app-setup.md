# Orchestration API — App Setup & Run Guide

Covers **what the codebase does today**: the NestJS 11 application scaffolded in
TODO-02 §1 (Project Bootstrap), the validated environment configuration of
TODO-02 §2 (Configuration Module), the hardened bootstrap of TODO-02 §3 —
helmet, env-driven CORS, morgan request logging, a global validation pipe, URI
versioning and a gated Swagger UI at `/docs` — the public unversioned
health probe of TODO-02 §4, `HEAD /health/ping`, and the global API-key
guard of TODO-02 §5: every NestJS-routed endpoint must send the `x-api-key`
header (missing or wrong → **401**), with `HEAD /health/ping` exempt via
`@Public()` — plus the TODO-03 contract layer for `POST /v1/transactions`
(request/response DTOs, custom validators, shared enums/constants and the
card-masking helper — consumed since TODO-05 by the orchestration service
and rendered on the live route since TODO-06 Cycle A, see
[DTO & validation layer (TODO-03)](#dto--validation-layer-todo-03)) — the two
external clients of TODO-04: the **Numerator client** (`src/numerator/`,
Task 1) and the **json-server client** (`src/json-server/`, Task 2), both
**registered in `AppModule` since Task 3** with the shared 4 s axios
timeout, and the **TODO-05 orchestration service**
(`src/transactions/`: `TransactionsModule` + `TransactionsService` + pure
`fee-rules.ts` — id reservation, masking, fee math and the
`TRANSACTIONS_RETURN_BODY` gate; see
[Transactions orchestration service (TODO-05)](#transactions-orchestration-service-todo-05))
— and, **live since TODO-06 Cycle A**, the thin `TransactionsController`,
so the app now **performs outbound HTTP to the mock services exactly while
`POST /v1/transactions` is invoked** (boot remains config reads only) and
the endpoint's auth (401), validation (400) and success shapes (201
envelope / bare 201) are externally observable. **Since TODO-06 Cycle B
the error contract is complete**: the global `AllExceptionsFilter` answers
every failure with the structured `{ statusCode, message, error }` body
(Numerator → 503; json-server unknown/5xx → 503, 4xx → 502; unknown →
generic 500), and a failed receivable write after the transaction was
persisted is compensated by an orphan-DELETE retry loop
(`TransactionCompensationService`). See
[Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a),
[Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b),
[API behavior at this stage](#api-behavior-at-this-stage)
and [Plan references](#plan-references).

## Table of Contents

- [Prerequisites](#prerequisites)
- [External services](#external-services)
- [Install](#install)
- [Environment file](#environment-file)
- [Environment configuration](#environment-configuration)
- [Run modes](#run-modes)
- [API behavior at this stage](#api-behavior-at-this-stage)
- [DTO & validation layer (TODO-03)](#dto--validation-layer-todo-03)
- [External clients (TODO-04)](#external-clients-todo-04)
- [Transactions orchestration service (TODO-05)](#transactions-orchestration-service-todo-05)
- [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)
- [Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b)
- [Verify](#verify)
- [npm scripts](#npm-scripts)
- [Plan references](#plan-references)
- [Related docs](#related-docs)

## Prerequisites

- **Node.js LTS v22+** (verified with v22.22.3) with **npm 10+** (verified with 10.9.8). The app uses npm (`package-lock.json`); do not mix package managers at the repo root.
- **Docker** — required only for the provided services below. No other databases or services are needed.

## External services

The challenge ships two mock services plus a debug sidecar, defined in
`docker-compose.yml` at the repo root. Start them from the repo root:

```bash
docker compose up
```

| Service       | URL                     | Role                                   |
|---------------|-------------------------|----------------------------------------|
| json-server   | `http://localhost:8080` | Fake DB: transactions + receivables    |
| Numerator API | `http://localhost:3000` | Sequential ID generation (mock)        |

Status vs. the code (TODO-04 + TODO-05 + both TODO-06 cycles): **both
clients exist, are wired** —
`src/numerator/` (Task 1) and `src/json-server/` (Task 2) are registered in
`AppModule` (Task 3, commit `7a4a149`), each with its own timeout-configured
axios instance, see
[External clients (TODO-04)](#external-clients-todo-04); their first and
only caller is `TransactionsService` (TODO-05, see
[Transactions orchestration service (TODO-05)](#transactions-orchestration-service-todo-05)),
and since TODO-06 Cycle A that service is driven over HTTP by
`TransactionsController` — so the **running app DOES call both services,
exactly while `POST /v1/transactions` is invoked** (both mocks must be
up via `docker compose up` for a successful create; boot itself still
only reads config). Since TODO-06 Cycle B the app can additionally issue
one `DELETE` against json-server during that same request — the orphan
compensation of [Error handling & compensation
(TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b), sent
through the TransactionsModule's own `HttpModule` instance with ZERO diffs
under `src/json-server/`). You can exercise the Numerator contract directly
with the curl recipes in that section — no
NestJS app involved (json-server wire-shape recipes:
[json-server client guide](json-server-client.md)).

## Install

```bash
npm install
```

Project-local install only — never global. Creates `node_modules/` and
`package-lock.json` at the repo root.

## Environment file

Copy the template and adjust values as needed:

```bash
cp .env.example .env
```

`.env` is gitignored (local only); `.env.example` is the only committed env
file and carries only placeholder/example values (see its comments for each
key: `NODE_ENV`, `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`,
`SWAGGER_ENABLED`, the optional `CORS_ORIGINS` and
`TRANSACTIONS_RETURN_BODY` notes, and the commented-out optional Numerator
resilience knobs `MAX_RETRIES` / `NUMERATOR_BASE_BACKOFF_MS`).

**Current-phase truth:** the app loads and validates `.env` at startup and now
**consumes** it. The global `ConfigModule` (TODO-02 §2, implemented) reads
`.env` during bootstrap — before the listening port is resolved — and every
variable below is validated then. As of §3 (T3, implemented) the hardened
`src/main.ts` reads `PORT`, `NODE_ENV`, `CORS_ORIGINS` and `SWAGGER_ENABLED`
exclusively through the validated `ConfigService` + `ConfigKeys`; the former
temporary direct `process.env.PORT` read (with its `3001` fallback) is gone, so
nothing bypasses validation at listen time. §5 (T5) added a fifth consumer:
the global `ApiKeyGuard` reads `API_KEY` through `ConfigService` on *every*
request — no consumer reads `process.env` directly. Later cycles added the
rest: both client services (boot-time reads, TODO-04 Task 3) and
`TransactionsService` (`TRANSACTIONS_RETURN_BODY` per `create()`, TODO-05) —
see the consumed/deferred breakdown under [Environment
configuration](#environment-configuration).

## Environment configuration

The schema lives in `src/config/env.validation.ts` (class-validator) and is
enforced at bootstrap by the global, cached `ConfigModule.forRoot({ validate })`
registered in `src/app.module.ts`. Environment consumers inject `ConfigService`
and reference keys through `ConfigKeys` (`src/config/config.keys.ts`) — never
literal key strings (see `brief.md` §4.1 and global-plan decisions G4/G5).

| Variable            | Required | Rules / default                                      | Purpose                                                                    | Example                    |
|---------------------|----------|------------------------------------------------------|----------------------------------------------------------------------------|----------------------------|
| `NODE_ENV`          | yes      | enum: `development` \| `production` \| `test`        | Environment name; also selects the morgan log format (`dev` vs `combined`) | `development`              |
| `PORT`              | yes      | integer > 0 (coerced from the raw env string)        | App listen port — consumed by the `main.ts` bootstrap                      | `3001`                     |
| `NUMERATOR_API_URL` | yes      | valid URL **including protocol** (TLD not required)  | Numerator API base URL — consumer: `NumeratorService` via `getOrThrow` at boot (TODO-04 Task 1; active since Task 3 registered the module) | `http://localhost:3000`    |
| `JSON_SERVER_URL`   | yes      | valid URL **including protocol** (TLD not required)  | json-server base URL — consumer: `JsonServerService` via `getOrThrow` at boot (TODO-04 Task 2; active since Task 3 registered the module) | `http://localhost:8080`    |
| `API_KEY`           | yes      | non-empty string                                     | Key the global `ApiKeyGuard` matches against `x-api-key` on every request (T5, active) | `your-secret-api-key-here` |
| `SWAGGER_ENABLED`   | no       | `"true"` \| `"false"`, default `true`                | Swagger UI (`/docs`) on/off switch — consumed at bootstrap                 | `true`                     |
| `CORS_ORIGINS`      | no       | comma-separated origins; absent/blank ⇒ allow all    | CORS allowlist — consumed by the `main.ts` bootstrap                       | `http://localhost:5173`    |
| `TRANSACTIONS_RETURN_BODY` | no | `"true"` \| `"false"`, default `true`         | Gates the response envelope: service-level consumer `TransactionsService` reads it per `create()` via `get(key, true)` — `false` ⇒ the service returns `undefined` (TODO-05; implemented at the SERVICE layer) and `TransactionsController` relays that result directly, so `true` ⇒ 201 + envelope, `false` ⇒ bare `201 CREATED` on `POST /v1/transactions` (TODO-06 Cycle A). **HTTP-observable today**; restart the app after changing it | `true` |
| `MAX_RETRIES` | no | integer ≥ 1, default `10` (in-code, `src/numerator/numerator.constants.ts`) | **Total** CAS attempts per `NumeratorService.getNextId()` call — not extra retries (TODO-04 Task 1 §1.3) | `10` |
| `NUMERATOR_BASE_BACKOFF_MS` | no | integer ≥ 1, default `20` (same file) | Base backoff for the conflict-retry sleep: `min(base × 2^retryIndex, 160 ms cap)` (TODO-04 Task 1 §1.3) | `20` |

**Fail-fast behavior:** with an invalid `.env` the application **refuses to
start**. Validation throws a single `Invalid environment configuration` error
that names **every** offending variable with its violated constraint — for
example `- PORT: PORT must be an integer number` or a missing `API_KEY` — and
points at `.env.example` as the reference. There is no partial startup and no
silent fallback for required variables; fix `.env` and boot again.

**Committed vs. local:** only `.env.example` (placeholders) is committed; your
own `.env` is gitignored. Never put real secrets in `.env.example`.

**Consumed now vs. later:** every validated `ConfigService` variable now
has a consumer. The `main.ts` bootstrap (TODO-02 §3, implemented) reads
`PORT` (listen port, `getOrThrow`), `NODE_ENV` (selects
the morgan log format), `CORS_ORIGINS` (CORS allowlist; absent ⇒ allow all)
and `SWAGGER_ENABLED` (mounts `/docs` or not; absent ⇒ enabled); the global
`ApiKeyGuard` (TODO-02 §5, implemented) checks `API_KEY` on every request;
`NumeratorService` (TODO-04 Task 1) resolves `NUMERATOR_API_URL` via
`getOrThrow` at construction, plus the optional `MAX_RETRIES` /
`NUMERATOR_BASE_BACKOFF_MS` knobs via `get(key, default)`;
`JsonServerService` (TODO-04 Task 2) resolves `JSON_SERVER_URL` via
`getOrThrow` at construction; and `TransactionsService` (TODO-05) reads
`TRANSACTIONS_RETURN_BODY` via `get(key, true)` on every `create()` call.
**Boot state (since Task 3 + TODO-05 + TODO-06 Cycle A):**
`NumeratorModule`, `JsonServerModule` and `TransactionsModule` are registered
in `AppModule`, so all three services are constructed at startup and the
clients' config reads execute then; `create()` now runs whenever
`POST /v1/transactions` is invoked, and **only** then do the clients send
outbound requests — the return-body gate is HTTP-observable on that route
(see [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)).

## Run modes

| Mode | Command | What happens |
|------|---------|--------------|
| Dev (watch) | `npm run start:dev` | Rebuild + restart on change, listens on the **validated `PORT`** from `.env` (`http://localhost:3001` with the example values) |
| Prod-style | `npm run build && npm run start:prod` | Compile to `dist/`, then run `node dist/main` |

Port `3001` was chosen to avoid conflicts with the provided services
(numerator-api on `3000`, json-server on `8080`).

## API behavior at this stage

With TODO-02 §3–§5 implemented, the HTTP surface behaves as follows
**today**:

- **`HEAD /health/ping` answers `200` with an empty body** (TODO-02 §4 —
  implemented). The route is **unversioned**: the controller declares
  `version: VERSION_NEUTRAL` (global-plan decision G8-R — the installed
  NestJS 11.2.3 has no `@SkipVersioncheck()`), so it lives outside `/v1`.
  It is **public** because the method-level `@Public()` decorator on
  `ping()` exempts it from the now-live global `ApiKeyGuard` (TODO-02 §5,
  T5) — without the decorator the guard would answer this route with `401`.
- **`POST /v1/transactions` is LIVE** (TODO-06 Cycle A) — the first
  business route, wiring `CreateTransactionDto` → `TransactionsService.create`.
  On it the global `ApiKeyGuard` answers **401** for a missing/wrong
  `x-api-key` header and the global `ValidationPipe` answers **400** for an
  invalid payload; a valid call answers **201** with the
  `{ transaction, receivable }` envelope — or a bare `201` (empty body)
  when `TRANSACTIONS_RETURN_BODY=false`. Domain failures (Numerator /
  json-server) answer with the mapped structured **503/502** bodies and a
  failed second write first triggers orphan-DELETE compensation — since
  **TODO-06 Cycle B** the global exception filter and compensation are
  LIVE, so the TODO §2.1 error table is **fully effective**. Full contract,
  knobs + fault-injection recipes:
  [Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b);
  behavior + happy-path recipes:
  [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a).
- **Every still-unmatched route 404s** — any path other than the two live
  ones (`HEAD /health/ping`, `POST /v1/transactions`): `/`, `/v1/anything`,
  even `/v1/health/ping` return the NestJS 404 body — already the
  structured `{ statusCode, message, error }` shape, passed through
  verbatim by the Cycle-B filter (global plan G10). A `GET` on
  `/health/ping` 404s too — the probe answers `HEAD` alone; likewise a
  `GET`/`PUT`/`DELETE` on `/v1/transactions` — only `POST` is defined.
  Guards run only on **matched** routes, so an unknown path 404s *before*
  the API-key check ever happens. Routes from later TODOs are served under
  `/v1/...` via URI versioning (`defaultVersion: '1'`, deliberately **no**
  global prefix) — and they arrive **protected** automatically: the global
  guard covers every route it matches. Unlike earlier stages, **401 is
  externally observable today** on the transactions route (T5 had proven
  the full 401/200 matrix with a throwaway protected route deleted before
  committing, T5 plan §10).
- **`/docs` is the one real page** (when Swagger is enabled, the default).
  Swagger serves itself outside the Nest router entirely, so versioning
  never prefixes it and the API-key guard never applies to it — the UI
  stays reachable without a key. The UI lists the health probe as a `head`
  operation on `/health/ping` — deliberately left visible (T4 decision C)
  — **plus, since TODO-06 Cycle A, the `POST /v1/transactions` operation**
  with request/response schemas and the documented error responses; the
  document carries a working **Authorize** button (T5, TODO-02 §5.3): see
  [Authorizing in Swagger UI](#authorizing-in-swagger-ui-x-api-key).
- **Every response — including the health `200` and every 404 — carries helmet
  security headers**
  (e.g. `x-content-type-options: nosniff`, `cross-origin-resource-policy`)
  and passes through the global `ValidationPipe` and CORS middleware.

### The API key guard (`x-api-key`)

`ApiKeyGuard` (`src/common/guards/api-key.guard.ts`) is registered globally
in `src/app.module.ts` through the `APP_GUARD` token. Behavior matrix
(TODO-02 §5.1): **every route requires the `x-api-key` header except
`/health/ping` (`@Public()`); a missing or invalid key → `401` — on matched
routes** (unknown paths 404 before the guard runs, and `/docs` lives
outside it).

- The expected value is `API_KEY` from `.env`, compared with a plain exact
  string match — deliberate for this challenge scope (plan decision G9:
  hashing / timing-safe comparison are out of scope).
- Rejection throws `UnauthorizedException`, so the reply is **401** with
  Nest's JSON body
  `{"statusCode":401,"error":"Unauthorized","message":"Missing or invalid x-api-key header"}`.
  **403 trap:** a guard that merely returned `false` would make Nest answer
  *403 Forbidden* — the throw is what keeps §5.1's "401 Unauthorized" true;
  never "simplify" it into a boolean return.
- A duplicated `x-api-key` header only passes when its **first** value is
  the exact key.
- Since TODO-06 Cycle A, `POST /v1/transactions` is the first committed
  **guard-protected** route (no `@Public()`, no `@UseGuards` — the global
  `APP_GUARD` registration is the single enforcement, plan decision G1), so
  a live `401` is externally observable today: send that POST without the
  header. (T5 had verified the full matrix earlier against a throwaway
  protected route, removed before committing, T5 plan §10 / G10.)

Quick probes (PowerShell: `curl` aliases to `Invoke-WebRequest` — always use
`curl.exe`):

```powershell
curl.exe -I http://localhost:3001/health/ping   # 200, empty body — no key sent; @Public() keeps the probe open
curl.exe -i http://localhost:3001/              # 404 + helmet security headers
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/v1/health/ping   # 404 — proves the probe is not under /v1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200 — Swagger UI is not a guarded route
```

The request shape for the live protected `/v1` route (full endpoint guide +
happy-path body: [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)):

```powershell
curl.exe -i -X POST http://localhost:3001/v1/transactions                                  # 401 (no key; 400 would follow without a valid body)
curl.exe -i -X POST http://localhost:3001/v1/transactions -H "x-api-key: <API_KEY value from your .env>"   # past the guard → ValidationPipe answers 400 (empty body)
```

(`-I` makes curl send a HEAD request and print only the response headers —
required for the health probe, which answers `HEAD` alone. `-i` prints status
+ headers for the generic 404 check; `-s -o NUL -w "%{http_code}"` prints only
the status code. The `/docs/` URL needs the trailing slash — the bare `/docs`
answers a 301 redirect.)

Each probe also prints a morgan line on the server console, e.g.:

```text
GET / 404 150 - 3.421 ms
```

Meaning (dev format): method, path, status, response size in bytes, elapsed
time. In `production`/`test` the `combined` format replaces this with the
Apache-style line (client IP, timestamp, request, status, size, referrer,
user-agent).

### Enabling / disabling Swagger (`/docs`)

`SWAGGER_ENABLED` is optional and defaults to `true`; only `false` disables
the UI. Set it in `.env`:

```env
SWAGGER_ENABLED=false
```

or override per-process without touching any file (process env wins over
`.env` in `ConfigService`):

```powershell
$env:SWAGGER_ENABLED = 'false'; npm run start:dev
Remove-Item Env:SWAGGER_ENABLED   # back to the .env/default value
```

Confirm either state from another terminal:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200 when enabled, 404 when disabled
```

### Authorizing in Swagger UI (`x-api-key`)

T5 (TODO-02 §5.3) wired the OpenAPI side of the guard in `main.ts`
`setupSwagger`: an `API-Key` apiKey scheme (header `x-api-key`) plus a
document-level security requirement, built from the shared constants in
`src/common/api-key.constants.ts`. To authenticate the UI:

1. Open `http://localhost:3001/docs/`.
2. Click the **Authorize** button in the top bar.
3. In the `API-Key` input, paste your local `.env` `API_KEY` value **exactly**
   and confirm.

From then on every **Try it out** call sends `x-api-key: <value>` — the
document-level requirement is what makes the header actually attach
(scheme declarations alone are inert in Swagger UI). Sanity-check the
schema from the CLI without a browser:

```powershell
curl.exe -s http://localhost:3001/docs-json | Select-String 'x-api-key' -SimpleMatch   # shows "name":"x-api-key","in":"header"
```

Cosmetic trade-off (recorded in T5 decision D10): because the security
requirement applies to the whole document, the public health probe also
renders a padlock in the UI — that badge is Swagger chrome only; the
endpoint itself stays guard-exempt.

## DTO & validation layer (TODO-03)

TODO-03 delivered the complete **contract** of `POST /v1/transactions`: the
classes that declare what the endpoint will accept and return. Per TODO-03
§6 this is contract-only work — **no controller, module, service, business
logic or tests were created**. The wiring arrived later: TODO-05 shipped
the service, and since **TODO-06 Cycle A** the contract is live —
consequences an agent must know today:

- `POST /v1/transactions` **is reachable** — `TransactionsController` binds
  this exact DTO contract to the route (see
  [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)).
- Swagger `/docs` **renders the operation** since TODO-06 Cycle A — the
   `@ApiProperty` metadata on every DTO below feeds the request/response
   schemas, and the controller's decorator set documents 201 + the error
   responses (the 502/503/500 bodies are REAL answers since the Cycle-B
   filter went live — see
   [Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b)).
- `TRANSACTIONS_RETURN_BODY` has its service-level gate (TODO-05) **and**
  the route that exposes it: `false` ⇒ bare `201` over HTTP today
  (toggle contract below).

| Artifact (paths under `src/`) | Role |
|-------------------------------|------|
| `transactions/dto/create-transaction.dto.ts` — `CreateTransactionDto` | Request body contract: all 7 fields required (rules below) |
| `transactions/dto/transaction-response.dto.ts` — `TransactionResponseDto` | Output shape of the `transaction` resource (masked card, string amounts) |
| `transactions/dto/receivable-response.dto.ts` — `ReceivableResponseDto` | Output shape of the `receivable` resource (json-server wire naming: `transaction_id`, `create_date`, …) |
| `transactions/dto/create-transaction-response.dto.ts` — `CreateTransactionResponseDto` | 201 envelope `{ transaction, receivable }`; documents the `TRANSACTIONS_RETURN_BODY` gate |
| `transactions/dto/validators/` | Custom constraints `IsPositiveDecimalString` and `IsFutureExpirationDate` (exact reject messages in their JSDoc) |
| `common/enums/` | `PaymentMethod` (`debit_card`/`credit_card`), `ReceivableStatus` (`paid`/`waiting_funds`) — string values **are** the wire values |
| `common/constants/payment-fee.constants.ts` | `PAYMENT_FEE_PERCENTAGES`: debit `"2"`, credit `"4"` — fee **percentage strings**, not amounts — consumed by `TransactionsService`/`fee-rules.ts` since TODO-05 |
| `common/utils/card-number.util.ts` | `maskCardNumber()`: pure last-4-digits helper — called on `TransactionsService`'s write path since TODO-05 |

### What the contract guarantees (enforced on the live route since TODO-06 Cycle A)

`CreateTransactionDto` field rules — invalid payloads are rejected with
**400** by the *existing* global `ValidationPipe`
(`whitelist`/`forbidNonWhitelisted`/`transform` in `src/main.ts`);
**unknown properties are rejected too** (same pipe, `forbidNonWhitelisted` —
no per-DTO option). Nothing new was added to the pipe in TODO-03.

- `value` — decimal string, strictly positive, at most 2 decimals (`"0"` /
  `"0.00"` rejected).
- `description` — non-empty string, ≤ 200 chars.
- `method` — exactly `"debit_card"` or `"credit_card"` (`PaymentMethod`).
- `cardNumber` — digits-only string, 13–19 chars (the **full** PAN, on
  purpose — see masking policy).
- `cardHolderName` — non-empty string, ≤ 100 chars.
- `cardExpirationDate` — `MM/YY` string that has not expired: valid from the
  first through the **last day** of the expiration month, timezone-free UTC
  comparison (`"04/28"` is accepted until 30 Apr 2028); impossible months
  (`"13/28"`) rejected.
- `cardCvv` — digits-only string, 3–4 chars.

Wire-format invariants the response DTOs encode: every monetary field
(`value`, `subtotal`, `discount`, `total`) and every id is a **string**;
`discount` is the fee **percentage as string**; `cardNumber` is the masked
**last 4 digits**. Response DTOs are output-only — zero `class-validator`
decorators by design (TODO-03 §2.3).

Maintenance note: Swagger/validation examples must stay **future-dated** —
the `cardExpirationDate` example `"04/28"` (request + response DTOs) stops
passing the validator on 2028-05-01; refresh all expiration examples at once
(G6 also sanctioned `"09/29"`-style dates for new prose).

### Masking policy

The request DTO **accepts the full card number** — that is what the client
sends. The last-4-only rule is an output/persistence invariant: the
orchestration service `TransactionsService` (TODO-05,
`src/transactions/transactions.service.ts`) truncates via `maskCardNumber()`
(`src/common/utils/card-number.util.ts`) when building the transaction
payload — *before* storing to json-server and answering; nothing stores or
returns the full PAN. The helper's runtime call-site is the service, and
since TODO-06 Cycle A the whole path is **exercised over HTTP** — every
successful `POST /v1/transactions` masks the card before persistence.

### Envelope switch (`TRANSACTIONS_RETURN_BODY`)

Optional boolean env var, default `true`, mirroring the `SWAGGER_ENABLED`
pattern (schema + `ConfigKeys.TransactionsReturnBody` + `.env.example`; the
env table above has its row). Consumed at the **service layer** since TODO-05:
`TransactionsService.create()` returns the full `{ transaction, receivable }`
envelope (built from the client-echoed bodies) when the flag is `true`, and
`undefined` when `false` (`get(key, true)`). The route-level translation —
`true` ⇒ 201 with the body, `false` ⇒ bare `201 CREATED` (TODO-03 §2.4) —
is **live since TODO-06 Cycle A**: `TransactionsController` returns the
service result directly and Nest serializes `undefined` as the empty-body
`201`. **Setting the flag is HTTP-observable today** (restart after
changing `.env`; TODO-03 shipped plumbing, TODO-05 the service gate,
TODO-06 Cycle A the route).

### Verifying the contract today

The endpoint is live, so the runtime exercises (curl against
`POST /v1/transactions`, Swagger rendering, 400/401/201 checks) are the
**user-run recipes** in
[Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)
— agents never execute them (global-plan G9 house rule). The compile-time
green signal for the layer stays:

```bash
npm run build   # exit 0 → DTOs, validators, enums, constants and helper compile & are importable
npm run lint    # exit 0
```

Each new file's JSDoc header records its purpose, TODO-03 section, exact
validator semantics/messages and current consumers (this cycle's TODO-06
truth sweep refreshed them all to endpoint reality: the service, route and
Swagger now exercise the contract; every spec-test remains the deferred
testing TODO).

## External clients (TODO-04)

TODO-04 builds the two outbound HTTP clients (@nestjs/axios `HttpService`
only — no other HTTP library). **All three tasks are implemented** on branch
`feat/external-clients`: Task 1 (Numerator client), Task 2 (json-server
client) and **Task 3 (module registration + HTTP timeout)** — both modules
are now wired into `AppModule` and both clients boot with a 4 s Axios
timeout (commit `7a4a149`). Everything below describes what exists today;
both clients have a **live HTTP path**: their only caller
`TransactionsService` (TODO-05) is invoked over HTTP by
`TransactionsController` since TODO-06 Cycle A, so outbound traffic to the
mock services happens whenever `POST /v1/transactions` runs (see
[Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)).

### Numerator client — `src/numerator/` (Task 1)

| Artifact | Role |
|----------|------|
| `numerator.service.ts` — `NumeratorService.getNextId(): Promise<string>` | The single public method: returns one unique sequential ID as a **string** (json-server string-id convention) |
| `numerator.module.ts` | `@Module` importing `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` — its own isolated configured axios instance (v4 has no `forRoot` — T1-D7/T3-D1); exports the service; **registered in `AppModule`** (Task 3, G14) |
| `numerator.constants.ts` | In-code defaults: `NUMERATOR_DEFAULT_MAX_RETRIES = 10`, `NUMERATOR_DEFAULT_BASE_BACKOFF_MS = 20`, backoff cap `MAX_NUMERATOR_BACKOFF_MS = 160`, `CAS_CONFLICT_STATUS = 400` |
| `../common/constants/http-timeout.constants.ts` | `HTTP_TIMEOUT_MS = 4000` — the shared timeout both client modules pass to `HttpModule.register` (Task 3, G12) |
| `errors/numerator.errors.ts` | Domain errors: `NumeratorUnavailableError`, `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError` |
| `interfaces/` | Wire shapes of the mock + retry-loop param/result objects (2-params rule) |

**Behavior of `getNextId()`** (TODO §1.3, global plan G5–G7): each of up to
`MAX_RETRIES` **total attempts** does `GET /numerator` → validate the value
is a finite number and `current + 1` a safe integer (otherwise
`InvalidNumeratorValueError`, **never retried**) → `PUT
/numerator/test-and-set { oldValue, newValue }`. On success the method
returns `String(candidate)`; the CAS is treated as atomic, so no other
caller can obtain the same ID. Each retry **re-reads** the current value —
the `currentNumerator` from a conflict body is used for logging only.

**Retry vs. fail-fast:** only a **genuine CAS conflict** retries — HTTP 400
whose body carries a numeric `currentNumerator`. Between attempts the client
sleeps `min(NUMERATOR_BASE_BACKOFF_MS × 2^retryIndex, 160 ms)` (no sleep
after the final conflict). Budget exhausted →
`NumeratorRetriesExhaustedError` (carries the attempt budget + last observed
value). Every other failure — network, timeout, 5xx, or a 400 **without**
`currentNumerator` (the mock's invalid-params shape) — aborts immediately as
`NumeratorUnavailableError`, so orchestration can stop before writing
anything. Conflicts log a `warn` line (attempt, current, candidate);
numerator values are non-sensitive, and card data must never appear in these
logs (global plan G13). Mapping any of these errors to HTTP responses (e.g.
503) is **not** this client's job — `TransactionsService` (TODO-05) also
propagates them raw on purpose: since TODO-06 **Cycle B** the global
`AllExceptionsFilter` answers all three Numerator errors with a structured
**503** carrying their messages verbatim (HTTP mapping per global plan
G18 → G4, LIVE).

**Config flow:** all reads go through `ConfigService` + `ConfigKeys` — never
`process.env`. `NUMERATOR_API_URL` is required (`getOrThrow` in the service
constructor — Task 1 is its first consumer); `MAX_RETRIES` and
`NUMERATOR_BASE_BACKOFF_MS` are **optional** and read with
`get(key, default)`; the defaults live only in `numerator.constants.ts`, so
existing `.env` files boot unchanged (global plan G3). **Wired state:**
`NumeratorModule` is registered in `AppModule` (Task 3), so the service is
constructed on every boot and resolves its config reads then — and its
`HttpModule` import uses the timeout-configured
`HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` form (`@nestjs/axios`
**v4 has no `forRoot`** — decision T1-D7, applied by plan decision T3-D1).
Since TODO-06 Cycle A the HTTP path is exercised: each successful
`POST /v1/transactions` runs `getNextId()` **twice** (both ids reserved
before any write), so with `docker compose up` + `npm run start:dev` the
full CAS traffic really happens.

### json-server client — `src/json-server/` (Task 2)

Full guide — endpoints + §2.4 payload tables, failure model, privacy rule,
curl wire-shape exercise: **[json-server client (TODO-04 Task 2)](json-server-client.md)**.
Summary of the committed surface:

| Artifact | Role |
|----------|------|
| `json-server.service.ts` — `createTransaction(payload)` / `createReceivable(payload)` | Transport-only POSTs to the two collections via `HttpService`; return the echoed resource body (typed `TransactionResponseDto` / `ReceivableResponseDto`, imported **type-only** per G11) |
| `json-server.module.ts` | `@Module` importing `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` — its own isolated configured axios instance, separate from the Numerator client's (T3-D2); exports the service; **registered in `AppModule`** (Task 3, G14) |
| `json-server.constants.ts` | Resource-path constants `transactions` / `receivables` (no timeout constant — the shared `HTTP_TIMEOUT_MS` lives in `src/common/constants/http-timeout.constants.ts`, added by Task 3) |
| `errors/json-server.errors.ts` | `JsonServerRequestError` — `resource` + `status: number \| undefined` (`undefined` on network/timeout/non-axios failures) + payload-free message |
| `interfaces/` | The two §2.4 transport payload types + 2-params-rule param objects |

- **What it never does:** generate ids, calculate fees, mask card numbers,
  default fields (even `create_date`), assert the 201 status (T2-D3) or
  **retry** — fail-fast is explicit TODO-04 §Out of scope policy; mapping
  failures to HTTP responses is the global `AllExceptionsFilter`'s job —
  **LIVE since TODO-06 Cycle B** (G18 → G4: it maps `JsonServerRequestError`
  to **503** on unknown/5xx statuses and **502** on 4xx, message verbatim).
- **Config:** `JSON_SERVER_URL` via `ConfigService.getOrThrow` at
  construction; trailing slashes normalized once (T2-D1). **No new env
  key arrived with this task** — the variable was validated since TODO-02.
- **Privacy:** payloads carry card data — never logged and never
  serialized into error messages; the only log line is one failure `warn`
  with resource + status (T2-D7).
- Unit/e2e tests for this client are deferred to a later TODO (TODO-04
  out-of-scope list).

### Contract exercises — curl against the Numerator mock (no docker commands from this guide)

The recipes below are transcribed from the mock source
(`numerator-api/api.js` + `numerator-api/numerator.js`) and were **not
live-verified during this docs cycle** — the services may or may not be
running. The mock is started via `docker compose up` at the repo root, but
**never run docker commands autonomously from an agent session — ask the
user** (TODO-04 §Context). If `localhost:3000` refuses connections, that
just means the service is down; the expected shapes below document
the exact traffic `NumeratorService` sends when `getNextId()` runs —
that caller (`TransactionsService`, TODO-05) is now driven by the live
`POST /v1/transactions` route (TODO-06 Cycle A), which runs this traffic
**twice per request**; so once the endpoint is invoked, all of this
traffic happens):

PowerShell (always `curl.exe`; JSON bodies need the `\"` escaping):

```powershell
# 1) Current value — 200, e.g. {"numerator":3} (the mock starts at 3 but advances with use)
curl.exe -s http://localhost:3000/numerator

# 2) Successful CAS (assume GET returned 3) — 200 {"numerator":4}
curl.exe -s -X PUT http://localhost:3000/numerator/test-and-set `
  -H "Content-Type: application/json" -d '{\"oldValue\":3,\"newValue\":4}'

# 3) Conflict — repeat call 2: oldValue 3 is now stale —
#    400 {"error":"Numerator does not match the expected old value.","currentNumerator":4}
curl.exe -s -X PUT http://localhost:3000/numerator/test-and-set `
  -H "Content-Type: application/json" -d '{\"oldValue\":3,\"newValue\":4}'

# 4) Invalid params — 400 {"error":"Invalid values for test-and-set."}
#    NOTE: NO currentNumerator — this is exactly the shape the client must
#    NOT retry (global plan G5 discriminator; compare with call 3)
curl.exe -s -X PUT http://localhost:3000/numerator/test-and-set `
  -H "Content-Type: application/json" -d '{\"oldValue\":\"x\",\"newValue\":4}'
```

State mutation warning: each **successful** PUT (call 2) permanently bumps
the mock's in-memory counter until the container restarts; the conflict and
invalid-params calls (3 and 4) change nothing. Call 1 (`GET`) is read-only.

### Wiring status & pending work

- **Task 3 — done (commit `7a4a149`):** **both** modules
  (`NumeratorModule`, `JsonServerModule`) are imported in `AppModule` (G14)
  and each configures its Axios instance via
  `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` —
  `HTTP_TIMEOUT_MS = 4000` from
  `src/common/constants/http-timeout.constants.ts` (per the TODO
  §Configuration & resilience 3–5 s guidance; v4 has no `forRoot` —
  T1-D7/T3-D1). Both services are injectable app-wide from here on; boot
  itself performs zero outbound requests — since TODO-06 Cycle A they call
  the mock services **only while `POST /v1/transactions` is invoked**
  (`TransactionsService` orchestration, their single caller).
- **Landed since then (TODO-05):** the orchestration service, its module,
  fee calculation and the card-number masking call-site — see
  [Transactions orchestration service (TODO-05)](#transactions-orchestration-service-todo-05) below.
- **Landed since then (TODO-06 Cycle A):** the `POST /v1/transactions`
  controller — route live, guard 401 / ValidationPipe 400 observable, full
  Swagger operation — see
  [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a).
- **Landed since then (TODO-06 Cycle B):** the global `AllExceptionsFilter`
  with structured 502/503/500 mapping (G18 → G4) and the
  `TransactionCompensationService` orphan-DELETE compensation (G5) — client
  and service domain errors now answer with their mapped structured body,
  never the NestJS default 500. The `transactions` json-server collection
  gained a second consumer (the compensation `DELETE`), issued through a
  TransactionsModule-local `HttpModule.register` instance; `src/json-server/`
  itself kept ZERO diffs (G7). Full behavior + recipes:
  [Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b).
- **Tests:** unit/e2e suites for both clients remain explicitly deferred by
  TODO-04 (§Out of scope) to a later TODO; TODO-05 adds none either.

### Transactions orchestration service (TODO-05)

TODO-05 (`.agent/todos/20260913/20260913-todo-5.md`, branch
`feat/transaction-orchestration`, commits `207f79c` `759bb62` `7b2176c`)
implemented the **business core** from a valid `CreateTransactionDto` to a
persisted transaction + receivable pair — as a service only, per the TODO's
explicit out-of-scope list (no controller/route/Swagger/guard usage/tests).

**Files** (`src/transactions/`):

| Artifact | Role |
|----------|------|
| `transactions.service.ts` — `TransactionsService.create(dto)` | The 9-step orchestrator (below); **exported and injectable app-wide** — invoked over HTTP by `TransactionsController` since TODO-06 Cycle A |
| `transactions.module.ts` — `TransactionsModule` | Imports `NumeratorModule` + `JsonServerModule` (both already registered by TODO-04 Task 3; importing them grants the exports), provides + exports the service, **registers `TransactionsController` since TODO-06 Cycle A**; registered in `AppModule` |
| `fee-rules.ts` | Pure fee/date functions (no Nest deps — designed as the unit-test target of a later TODO): `resolveReceivableStatus`, `computeTotal`, `formatDateDDMMYYYY` |

**`create()` flow (strict order — the 9 steps of TODO §Flow):**

1. `transactionId = await numeratorService.getNextId()`
2. `receivableId = await numeratorService.getNextId()` — **both ids reserved
   before any write** (second reservation fails ⇒ nothing persisted, zero
   orphans)
3. `maskCardNumber(dto.cardNumber)` at payload-build time → last-4 only
   stored/returned (full PAN never persists)
4. Fee data: `discount = PAYMENT_FEE_PERCENTAGES[dto.method]`;
   `status = resolveReceivableStatus(method)`;
   `total = computeTotal(subtotal, discount)`;
   `create_date = formatDateDDMMYYYY(new Date())` → `DD/MM/YYYY` of local
   now
5. Build `CreateTransactionPayload` (reserved id + DTO fields with masked
   card — transport interface, `src/json-server/interfaces/`)
6. Build `CreateReceivablePayload` (reserved id + `transaction_id` + fee
   data)
7. `jsonServerService.createTransaction(payload)`
8. `jsonServerService.createReceivable(payload)` (strict
   transaction-then-receivable order)
9. Gate on `ConfigKeys.TransactionsReturnBody` via
    `configService.get(key, true)`: return the envelope
    (`CreateTransactionResponseDto`, both bodies **echoed from the client
    responses**) — or `undefined` when the flag is `false` (the route is
    live since TODO-06 Cycle A: `TransactionsController` relays the result
    directly, so `undefined` yields Nest's natural **bare `201`** —
    `@HttpCode(HttpStatus.CREATED)` sets the status on the nil-body send)

**Fee rules table** (TODO §Fee, `brief.md` §3.2 — fee percentages come only
from `PAYMENT_FEE_PERCENTAGES`):

| Method | Fee % | `discount` (stored) | Receivable `status` | Settlement | `create_date` |
|--------|-------|---------------------|---------------------|------------|---------------|
| `debit_card`  | 2 | `"2"` | `paid`          | D+0  | now, `DD/MM/YYYY` |
| `credit_card` | 4 | `"4"` | `waiting_funds` | D+30 | now, `DD/MM/YYYY` |

- **Payment timing lives in `status`, NOT in a `payment_date` field** (user
  ruling "Option B", 2026-09-14 — supersedes TODO §Fee's payment-date
  phrasing, impl-plan §8 D1). There is no `payment_date` anywhere: no
  payload field, no DTO field, no helper, and **no date-arithmetic code**
  (a D+30 computation would be dead). The D+30 settlement of credit-card
  receivables is expressed purely by the `waiting_funds` status value.
- `total = subtotal × (1 − discount/100)` computed in **integer cents**
  (`computeTotal`: subtotal→cents via `Math.round(parseFloat × 100)`, then
  `Math.floor(cents × remaining% / 100)`, then re-formatted as
  `whole.dd` string). "Drop decimals beyond 2 positions" = **truncation
  toward −∞** (positive ⇒ toward zero), never banker's/decimal rounding.
  Worked examples:
  - `"250.00"` @ credit 4% → `25000 × 96 / 100 = 24000` → `"240.00"`
  - `"340.50"` @ debit 2% → `34050 × 98 / 100 = 33369` → `"333.69"`
  - `"10.01"` @ credit 4% → `1001 × 96 / 100 = 960.96` → floor → `960` →
    `"9.60"`
  - `"0.01"` @ debit 2% → `1 × 98 / 100 = 0.98` → floor `0` → `"0.00"` (valid
    edge; the DTO validator still only requires a positive subtotal)
- `subtotal` = `dto.value` verbatim as string; all money fields stay
  **strings** on payloads and responses (wire invariants,
  [DTO & validation layer](#dto--validation-layer-todo-03)).

**Errors (TODO §Error behaviour):** `getNextId()` rejections (Numerator
domain errors) and `JsonServerRequestError` from either write propagate
**raw** out of `create()`. At the TODO-05 commit the service had zero
try/catch and a failed second write left a **partially written state** (an
orphan transaction) — accepted then, because compensation + structured HTTP
mapping were reserved for TODO-06 **Cycle B**. **That is no longer the
reality**: since Cycle B the service's ONE try/catch wraps
`createReceivable`, an orphaned transaction is deleted by
`TransactionCompensationService`, the original error is rethrown, and the
global `AllExceptionsFilter` answers it with the mapped structured 502/503
body — global plan G18 → G4/G5, now LIVE; see
[Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b).
The one success log line carries **only** the two numeric ids — never
payloads/card data.

**How to use / test later (AI-agent guidance):**
- `TransactionsService` is injectable anywhere in the DI graph and since
  TODO-06 Cycle A is ALSO invoked over HTTP by `POST /v1/transactions` —
  but the house rule stands (**agents execute no live HTTP**; docker
  services only via user), so this docs cycle records **no live-verified
  wire observations**; expected shapes above and in the endpoint section
  are transcribed from the interfaces and the two client docs
  ([json-server client guide](json-server-client.md), Numerator section
  above).
- Later unit-test target (deferred testing TODO): `fee-rules.ts` needs no
  Nest/DI harness (pure functions; examples above are ready-made tables);
  `create()` order/echo behavior needs `NumeratorService` +
  `JsonServerService` mocks only. The gate reads `get(key, true)` — test in
  both flag states.
- The green signal stays `npm run build` + `npm run lint` (exit 0);
  `POST /v1/transactions` is **live** — user-run exercises in
  [Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a).

## Transactions endpoint (TODO-06 Cycle A)

TODO-06 §Task 1 + §Task 3 (`.agent/todos/20260913/20260913-todo-6.md`;
branch `feat/transactions-endpoint`, v0.5.0, commit `d12676f`; global plan
`.kilo/plans/20260914-transactions-endpoint.md` G1–G3/G6 + cycle plan
`.kilo/plans/20260914-transactions-controller.md`) landed the HTTP surface:
`src/transactions/transactions.controller.ts` — a thin
`@Controller('transactions')` (no `version` metadata: the global
`defaultVersion: '1'` mounts it at **`POST /v1/transactions`**, contrast
the `VERSION_NEUTRAL` health probe) with a single `@Post()` handler that
binds `CreateTransactionDto` → `TransactionsService.create(dto)` and
**returns the service result directly** (G3: validate → call → return; no
try/catch, no business logic). Registered via
`controllers: [TransactionsController]` in `TransactionsModule`
(`AppModule` import pre-existing).

| Behavior | Status today |
|----------|--------------|
| Auth | Global `ApiKeyGuard` (`APP_GUARD`) — deliberately NO `@UseGuards`/`@Public()` on the controller (single enforcement, G1): missing/wrong `x-api-key` → **401** — observable |
| Validation | Global `ValidationPipe` vs `CreateTransactionDto` → **400**, unknown properties rejected — observable |
| Success (default) | `TRANSACTIONS_RETURN_BODY=true` → **201** + `{ transaction, receivable }` envelope |
| Success (bare) | `TRANSACTIONS_RETURN_BODY=false` → service returns `undefined` → **201 with empty body** (`@HttpCode(201)` + nil-body send); restart after changing `.env` |
| Domain errors | `NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` / `InvalidNumeratorValueError` → **503**; `JsonServerRequestError` → **503** (unknown/5xx) / **502** (4xx) — mapped by the global `AllExceptionsFilter` since TODO-06 Cycle B. If the receivable write fails after the transaction was persisted, an orphan-DELETE compensation runs FIRST (bounded retries), then the original error maps; a surviving orphan is possible but reduced (§2.2) |
| Swagger | Operation fully documented at `/docs` (legacy decorator set — verified non-deprecated in installed `@nestjs/swagger` 11.4.7 — + `@ApiBadGateway`/`@ApiInternalServerError`; the documented 502/503/500 bodies ARE real answers since the Cycle-B filter landed) |

> **Shipped — TODO-06 Cycle B (same TODO file + branch):** structured
> **502/503/500 error mapping** via the global `AllExceptionsFilter` (G4)
> and **partial-failure compensation** for orphaned transactions (G5) are
> LIVE. The TODO §2.1 error table is fully effective: 400/401/201 keep
> working exactly as specified, the 503/502/500 rows and the consistent
> `{ statusCode, message, error }` body are implemented.
> Full contract, compensation knobs + fault-injection recipes:
> [Error handling & compensation (TODO-06 Cycle B)](#error-handling--compensation-todo-06-cycle-b).

### How to exercise it (user-run examples — agents never execute these)

Prerequisite: both mock services up — `docker compose up` at the repo root
(json-server on `:8080`, Numerator on `:3000`) — then `npm run start:dev`
(app listens on **`3001`** with the example `.env`). Transcribed from the
TODO §Implementation guidance / cycle plan §8:

Via **Swagger**: open `http://localhost:3001/docs/` → **Authorize** →
paste your `.env` `API_KEY` exactly (document-level requirement sends the
header on Try-it-out) → expand `POST /v1/transactions` → try the
`CreateTransactionDto` example body (test PAN `4111111111111111`).

Via **curl** (PowerShell — always `curl.exe`; `\"` escapes inside JSON):

```powershell
# 0) health regression — still 200, no key needed
curl.exe -I http://localhost:3001/health/ping

# 1) happy path — expect 201 + envelope (ids continue after the seed's "3":
#    e.g. transaction "4" + receivable "5"; card masked to "1111";
#    credit_card ⇒ discount "4", total "96.00", status "waiting_funds";
#    both rows then present in json-server)
curl.exe -i -X POST http://localhost:3001/v1/transactions `
  -H "Content-Type: application/json" `
  -H "x-api-key: your-secret-api-key-here" `
  -d '{\"value\":\"100.00\",\"description\":\"T-Shirt Black M\",\"method\":\"credit_card\",\"cardNumber\":\"4111111111111111\",\"cardHolderName\":\"Jane Doe\",\"cardExpirationDate\":\"12/28\",\"cardCvv\":\"123\"}'

# 2) same call WITHOUT the x-api-key header → 401
# 3) same call with an invalid field (e.g. "value":"-5") → 400
# 4) TRANSACTIONS_RETURN_BODY=false in .env, restart → 201 + EMPTY body
```

Fee/id/echo expectations follow the
[Transactions orchestration service (TODO-05)](#transactions-orchestration-service-todo-05)
flow above. These flows were **not live-executed by any agent cycle**
(global plan G9) — first-hand verification belongs to the user.

## Error handling & compensation (TODO-06 Cycle B)

TODO-06 §Task 2 (`.agent/todos/20260913/20260913-todo-6.md` §2.1–§2.3;
same branch `feat/transactions-endpoint`) completed the error contract:
`2416915` added the global `AllExceptionsFilter` (`src/common/filters/`,
registered via `APP_FILTER` in `app.module.ts`), `1b73935` added the
compensation class (`transaction-compensation.service.ts`), its
`compensation.constants.ts` knobs and the single service try/catch, and
`271c94b` fixed the controller's Swagger descriptions to match reality;
`35d314d` (4.3 review fix — single-section boolean helpers; its
`isNumeratorError` deviates from the plan snippet only by typing the
return as a TS type predicate) and `6e709f9` (4.3 simplification: stale
comment sweep + reason-computation hoist). Every unhandled exception now
answers with the structured `{ statusCode, message, error }` JSON body —
Nest's default error output is gone except the deliberate generic 500
(row below).

### Status contract (§2.1 — all rows EFFECTIVE)

| Cause | Status | Reply body |
|-------|--------|------------|
| DTO validation failure (global `ValidationPipe`) | **400** | Nest's own body passes through **verbatim** — the `message` **array** of validator strings survives unchanged (CB-D2a; guard against "fixes" that stringify it) |
| Missing/invalid `x-api-key` (global `ApiKeyGuard`) | **401** | Nest's guard body passes through verbatim |
| Unknown route | **404** | Nest's own 404 body passes through verbatim — already the structured 3-key shape (global plan G10) |
| `NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` / `InvalidNumeratorValueError` | **503** | `message` verbatim (payload-safe by construction, carries e.g. the "after N attempts" detail), `error: "Service Unavailable"` |
| `JsonServerRequestError` with `status` unknown or ≥ 500 | **503** | `message` verbatim, `error: "Service Unavailable"` |
| `JsonServerRequestError` with a 4xx status | **502** | `message` verbatim, `error: "Bad Gateway"` |
| Any other (unknown) error | **500** | Generic body `{"statusCode":500,"message":"Internal server error","error":"Internal Server Error"}` in **every** environment |

- **502 over the "or 500" alternative (decided in G4/CB-D2):** an
  unexpected upstream 4xx is a contract anomaly behind this gateway — 502
  tells clients "the service I proxy answered wrongly", which is more
  truthful than 500 "I broke"; it also matches the `@ApiBadGatewayResponse`
  already shipped in Cycle A. 5xx/unknown upstream statuses → 503.
- **`error` phrases** come from a local `HTTP_STATUS_PHRASES` map in
  `src/common/filters/all-exceptions.filter.ts` — zero new dependencies.
- **Domain messages are never rewritten (CB-D2b):** clients throw
  payload-free messages (T2-D7); the filter copies them verbatim, so no
  fixed string loses the §2.1-required detail.

### Production stack rule (CB-D3 — log-only)

The filter has a **zero-dependency constructor**: no `ConfigService`, no
`NODE_ENV` read. Unknown errors log `error.message` + `error.stack`
server-side via `Logger.error` **always**, and the client receives the
generic 500 body **in every environment**. A stack or internal detail
therefore **cannot** reach a response by construction — this is stronger
than the §2.3 "no leak when `NODE_ENV=production`" requirement and immune
to a forgotten env branch.

### Logging privacy

Every log line in the error/compensation path carries **ids, attempt
counters and axios-generated reasons ONLY**. Request payloads (card data)
and upstream response bodies are never logged and never serialized into
messages anywhere (T2-D7/G5/G13).

### Partial-failure compensation (§2.2 — orphans REDUCED, not eliminated)

When `createTransaction` succeeded but `createReceivable` failed, the
transaction row already exists, so `TransactionsService` wraps **that one
call** in the pipeline's **only** try/catch — and it catches **ANY** error
(CB-D6: network/timeout/5xx/4xx all leave the same orphan; only Numerator
failures stay pre-write and outside the try). It awaits
`TransactionCompensationService.deleteTransaction(transactionId)`, then
**rethrows the ORIGINAL receivable error** — the client still receives the
mapped 502/503 above; compensation never masks it, and `deleteTransaction`
itself **never throws** (contract CB-D4): it returns `true` (deleted or
already absent) or `false` (still orphaned).

| Knob | Value | Defined in |
|------|-------|------------|
| Total DELETE attempts | `COMPENSATION_MAX_ATTEMPTS = 3` | `src/common/constants/compensation.constants.ts` |
| Backoff between attempts | `min(200 × 2^(attempt−1), 1600)` ms — `COMPENSATION_BASE_BACKOFF_MS = 200`, no sleep after the last attempt | same file |
| Backoff ceiling | `COMPENSATION_MAX_BACKOFF_MS = 1600` | same file |

- DELETE target: `{JSON_SERVER_URL}/transactions/:id`, sent through the
  `TransactionsModule`'s own `HttpModule.register({ timeout: 4000 })`
  instance (isolated-instance precedent T3-D2) — `src/json-server/` has
  ZERO diffs; only `TRANSACTIONS_RESOURCE_PATH` is imported from its
  constants (G7).
- A **404 on the DELETE counts as success** (CB-D4a): the row is already
  gone; retrying a permanent 404 would waste the budget.
- If all attempts fail, exactly **one** `logger.error` line records the
  surviving orphan (transaction id + receivable failure reason ONLY).
- **No env keys back the knobs** (G7) — in-code constants, mirroring
  `http-timeout.constants.ts`. No saga, no circuit breaker: the TODO's
  goal is to REDUCE orphans; a still-failing DELETE leaves the
  inconsistency logged.
- Registration: `TransactionCompensationService` is provided by
  `TransactionsModule` and **not exported** (private-member rule — its only
  consumer is `TransactionsService`).

### Fault-injection recipes (user-run — agents never execute docker/HTTP)

Prerequisites: `docker compose up` + `npm run start:dev` (PowerShell,
always `curl.exe`):

1. **401:** `curl.exe -i -X POST http://localhost:3001/v1/transactions`
   (no header) → 401 +
   `{"statusCode":401,"error":"Unauthorized","message":"Missing or invalid x-api-key header"}`.
2. **400:** valid key + `"value":"-5"` → 400 with `message` as an ARRAY of
   validator strings, `error: "Bad Request"`.
3. **503 (Numerator down):** `docker compose stop numerator-api` → valid
   POST →
   `503 {"statusCode":503,"message":"connect ECONNREFUSED …","error":"Service Unavailable"}`;
   restart with `docker compose start numerator-api`.
4. **503 (json-server down):** `docker compose stop json-server` → valid
   POST → 503 (fails at the **first** write, before any persistence — no
   orphan, nothing to compensate); restart.
5. **502 / receivable-only failure (compensation path):** NOT forceable via
   configuration alone (needs json-server to accept the transaction POST but
   reject the receivable POST); documented honestly as **deferred to the
   TODO-07 test cycle** — no fake recipe is provided.
6. **Production stack check:** set `NODE_ENV=production` in `.env`, restart,
   run recipe 3 → the 503 body is still the structured 3-key body with **no
   stack trace**; the stack appears only on the server console via the Nest
   logger (for the unknown-error branch, any unhandled crash logs
   `Unhandled exception: …` server-side while the client gets the generic
   500).

## Verify

With the app running, check the behavior described in
[API behavior at this stage](#api-behavior-at-this-stage):

```bash
curl -I http://localhost:3001/health/ping
```

Expected: **`HTTP/1.1 200 OK`** with **no body** — the unversioned health
probe (TODO-02 §4), public via `@Public()` under the live API-key guard
(TODO-02 §5), is up. Then:

```bash
curl -i http://localhost:3001/
```

Expected: **`HTTP 404`** — every still-unmatched route 404s (a real reply,
not a connection error; matched routes only are guard-checked, so unknown
paths 404 rather than 401) with **helmet security headers** on the response,
and the morgan request line printed on the server console. Unlike earlier
stages, a live **401** IS externally observable now — `POST /v1/transactions`
(Guard & full behavior matrix: [API behavior at this
stage](#api-behavior-at-this-stage) and
[Transactions endpoint (TODO-06 Cycle A)](#transactions-endpoint-todo-06-cycle-a)).
Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/docs/
```

Expected: **`200`** with the default configuration (`SWAGGER_ENABLED` unset
or `true`); see the Swagger subsection above for the disabled case.

Quality gates (all must exit `0`):

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

`npm test` and `npm run test:e2e` exit `0` with **"No tests found"**: the Jest
configs set `passWithNoTests: true` because unit/e2e suites are explicitly out
of scope for TODO-02 and arrive in later work.

## npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `nest build` | Compile TS → `dist/` (uses `tsconfig.build.json`) |
| `start` | `nest start` | Run without watch |
| `start:dev` | `nest start --watch` | Dev watch mode |
| `start:debug` | `nest start --debug --watch` | Debug inspector + watch |
| `start:prod` | `node dist/main` | Run compiled output (build first) |
| `lint` | `eslint "{src,test}/**/*.ts" --fix` | Lint (flat config: `eslint.config.mjs`) |
| `test` / `test:watch` / `test:cov` | `jest …` | Unit config embedded in `package.json` (`src/**/*.spec.ts`) |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | e2e config (`test/`) |

## Plan references

- Global plan (TODO-02, binding decisions G1–G17):
  [`.kilo/plans/20260913-project-foundation.md`](../.kilo/plans/20260913-project-foundation.md)
- T1 bootstrap plan (scaffold scope):
  [`.kilo/plans/20260913-project-foundation-t1-bootstrap.md`](../.kilo/plans/20260913-project-foundation-t1-bootstrap.md)
- T2 configuration plan (env schema, decisions A1–A10 + A4-R URL strictness):
  [`.kilo/plans/20260913-project-foundation-t2-config.md`](../.kilo/plans/20260913-project-foundation-t2-config.md)
- T3 bootstrap plan (§3 hardening, decisions A–N + addendum A3-R ConfigService
  call-site patterns: `getOrThrow` for required keys, `get(key, default)` for
  `SWAGGER_ENABLED`):
  [`.kilo/plans/20260913-project-foundation-t3-bootstrap.md`](../.kilo/plans/20260913-project-foundation-t3-bootstrap.md)
- T3 simplification plan (S1: `splitOrigins` folded into `resolveCorsOrigins`):
  [`.kilo/plans/20260913-project-foundation-t3-simplify.md`](../.kilo/plans/20260913-project-foundation-t3-simplify.md)
- T4 health plan (§4 probe; decision G8-R unversioning via `VERSION_NEUTRAL`,
  Swagger-visibility decision C):
  [`.kilo/plans/20260913-project-foundation-t4-health.md`](../.kilo/plans/20260913-project-foundation-t4-health.md)
- T4 simplification plan (health curl how-to moved into `ping()` JSDoc):
  [`.kilo/plans/20260913-project-foundation-t4-simplify.md`](../.kilo/plans/20260913-project-foundation-t4-simplify.md)
- T5 API-key guard plan (§5 guard/decorator/constants, binding decisions
  D1–D12, the G10 temp-route verification protocol in §10 — the throwaway
  protected route it used is deliberately **not** in the repo; includes the
  post-review correction that `APP_GUARD` comes from `@nestjs/core`):
  [`.kilo/plans/20260913-project-foundation-t5-api-key-guard.md`](../.kilo/plans/20260913-project-foundation-t5-api-key-guard.md)
- T1 source TODO: [`.agent/todos/20260913/20260913-todo-2.md`](../.agent/todos/20260913/20260913-todo-2.md) §1;
  T2 source TODO: same file §2; T3 source TODO: same file §3;
  T4 source TODO: same file §4; T5 source TODO: same file §5
- TODO-03 global plan (cycle TD, binding decisions G1–G11 + §5 env-flag
  resolution):
  [`.kilo/plans/20260913-todo-3-transaction-dtos.md`](../.kilo/plans/20260913-todo-3-transaction-dtos.md);
  cycle TD implementation plan:
  [`.kilo/plans/20260913-todo-3-transaction-dtos-impl.md`](../.kilo/plans/20260913-todo-3-transaction-dtos-impl.md);
  source TODO: [`.agent/todos/20260913/20260913-todo-3.md`](../.agent/todos/20260913/20260913-todo-3.md)
  §§ Task 1–4
- TODO-04 global plan (external clients — Numerator + json-server; binding
  decisions G1–G19):
  [`.kilo/plans/20260913-external-clients.md`](../.kilo/plans/20260913-external-clients.md);
  Task 1 (Numerator client) implementation plan (decisions T1-D1–T1-D8,
  incl. T1-D6 architecture reconciliation and the T1-D7 finding that
  `@nestjs/axios` v4 exposes `HttpModule.register`, not `forRoot`):
  [`.kilo/plans/20260913-numerator-client.md`](../.kilo/plans/20260913-numerator-client.md);
  Task 2 (json-server client) implementation plan (decisions
  T2-D1…T2-D13 — base-URL normalization, no 201 assertion, payload-free
  logs/errors, bare-module preview, deferred config-JSDoc sweep):
  [`.kilo/plans/20260913-jsonserver-client.md`](../.kilo/plans/20260913-jsonserver-client.md);
  Task 3 (module registration) implementation plan (decisions T3-D1 `register`
  not `forRoot`, T3-D2 per-module isolated instances, T3-D3 temp DI-sanity
  script): [`.kilo/plans/20260913-client-modules-registration.md`](../.kilo/plans/20260913-client-modules-registration.md);
  source TODO: [`.agent/todos/20260913/20260913-todo-4.md`](../.agent/todos/20260913/20260913-todo-4.md)
  §Task 1–§Task 3 + §"Configuration & resilience" (all three tasks
  implemented; §Task 3 carries the workflow's final `[DONE]` mark once
  its 4.5b/4.6 steps close)
- TODO-06 global plan (transactions endpoint & error handling — two cycles:
  A = controller & wiring G1–G3/G6 [**implemented**], B = exception filter
  G4 + compensation G5 [**implemented** — commits `2416915` `1b73935`
  `271c94b` `35d314d` `6e709f9`; binding decisions G1–G10 incl. the G10
  404 pass-through, frozen surfaces G7, no-live-HTTP gates G9):
  [`.kilo/plans/20260914-transactions-endpoint.md`](../.kilo/plans/20260914-transactions-endpoint.md);
  Cycle A implementation plan (decisions CA-D1…CA-D8, incl. CA-D6
  deferral of this step's JSDoc truth sweep):
  [`.kilo/plans/20260914-transactions-controller.md`](../.kilo/plans/20260914-transactions-controller.md);
  Cycle B behavior contract: this guide's
  ["Error handling & compensation (TODO-06 Cycle B)"](#error-handling--compensation-todo-06-cycle-b)
  section (decisions CB-D1…CB-D8);
  source TODO: [`.agent/todos/20260913/20260913-todo-6.md`](../.agent/todos/20260913/20260913-todo-6.md)
  §Task 1 + §Task 3 (Cycle A) + §Task 2 (Cycle B — runtime-complete;
  `[DONE]`/archive marks belong to workflow steps 4.6/5)

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- [json-server client guide](json-server-client.md) — TODO-04 Task 2 deep-dive
  (endpoints, §2.4 payloads, failure model, curl wire-shape exercise).
- TODO-05 orchestration: this guide's
  ["Transactions orchestration service (TODO-05)"](#transactions-orchestration-service-todo-05)
  section; global/impl plans in `.kilo/plans/20260914-transaction-orchestration.md`
  (+ `-impl.md`); task file `.agent/todos/20260913/20260913-todo-5.md`.
- TODO-06 endpoint (Cycle A) + error handling & compensation (Cycle B):
  this guide's
  ["Transactions endpoint (TODO-06 Cycle A)"](#transactions-endpoint-todo-06-cycle-a)
  and ["Error handling & compensation (TODO-06 Cycle B)"](#error-handling--compensation-todo-06-cycle-b)
  sections; plans in "Plan references" above; task file
  `.agent/todos/20260913/20260913-todo-6.md` (both cycles implemented —
  same branch).
- Target architecture of the completed API (status block marks the parts
  already implemented): [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
