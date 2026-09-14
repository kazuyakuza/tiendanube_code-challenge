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
card-masking helper: compiled, **not yet wired to a route** — see
[DTO & validation layer (TODO-03)](#dto--validation-layer-todo-03)) — and the
first external client of TODO-04: the **Numerator client** (`src/numerator/`,
code-complete; it performs no live traffic until Task 3 registers its module —
see [External clients (TODO-04)](#external-clients-todo-04)).
See [API behavior at this stage](#api-behavior-at-this-stage)
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

Status vs. the code (TODO-04): the **Numerator client exists** in
`src/numerator/` (Task 1, see
[External clients (TODO-04)](#external-clients-todo-04)), but
`NumeratorModule` is not registered in `AppModule` until Task 3, so the
**running app still makes no outbound call to either service** (json-server
client = Task 2). You can exercise the Numerator contract directly with the
curl recipes in that section — no NestJS app involved.

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
request — no consumer reads `process.env` directly.

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
| `NUMERATOR_API_URL` | yes      | valid URL **including protocol** (TLD not required)  | Numerator API base URL — first consumer: `NumeratorService` via `getOrThrow` (TODO-04 Task 1; executes once Task 3 registers the module) | `http://localhost:3000`    |
| `JSON_SERVER_URL`   | yes      | valid URL **including protocol** (TLD not required)  | json-server base URL (future client wiring)                                | `http://localhost:8080`    |
| `API_KEY`           | yes      | non-empty string                                     | Key the global `ApiKeyGuard` matches against `x-api-key` on every request (T5, active) | `your-secret-api-key-here` |
| `SWAGGER_ENABLED`   | no       | `"true"` \| `"false"`, default `true`                | Swagger UI (`/docs`) on/off switch — consumed at bootstrap                 | `true`                     |
| `CORS_ORIGINS`      | no       | comma-separated origins; absent/blank ⇒ allow all    | CORS allowlist — consumed by the `main.ts` bootstrap                       | `http://localhost:5173`    |
| `TRANSACTIONS_RETURN_BODY` | no | `"true"` \| `"false"`, default `true`         | When `false`, `POST /v1/transactions` answers a bare `201 CREATED` instead of the full `{ transaction, receivable }` body (TODO-03 §2.4; plumbing only — runtime consumer arrives in TODO-04) | `true` |
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

**Consumed now vs. later:** six sets of variables now have consumers of the
validated `ConfigService`. The `main.ts` bootstrap (TODO-02 §3,
implemented) reads `PORT` (listen port, `getOrThrow`), `NODE_ENV` (selects
the morgan log format), `CORS_ORIGINS` (CORS allowlist; absent ⇒ allow all)
and `SWAGGER_ENABLED` (mounts `/docs` or not; absent ⇒ enabled); the global
`ApiKeyGuard` (TODO-02 §5, implemented) checks `API_KEY` on every request;
and `NumeratorService` (TODO-04 Task 1) resolves `NUMERATOR_API_URL` via
`getOrThrow` at construction, plus the optional `MAX_RETRIES` /
`NUMERATOR_BASE_BACKOFF_MS` knobs via `get(key, default)`. **Runtime caveat:** because
`NumeratorModule` is only registered in `AppModule` by Task 3, no instance
of that service boots today — the reads execute once Task 3 lands. Still
without any consumer: `JSON_SERVER_URL` (json-server client, TODO-04 Task 2)
and `TRANSACTIONS_RETURN_BODY`
(see [DTO & validation layer (TODO-03)](#dto--validation-layer-todo-03)).

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
- **Every other route 404s.** No business controllers are registered yet,
  so any other path — `/`, `/v1/anything`, even `/v1/health/ping` — returns
  the NestJS default 404 (a `GET` on `/health/ping` 404s too: the probe
  answers `HEAD` alone). Guards run only on **matched** routes, so an
  unknown path 404s *before* the API-key check ever happens. Business
  routes from later TODOs will be served under `/v1/...` via URI versioning
  (`defaultVersion: '1'`, deliberately **no** global prefix) — and they
  arrive **protected** automatically: the global guard covers every route it
  matches. The guard itself is live now, but no committed endpoint is
  guard-protected today (the only registered route is the public probe and
  per plan decision G10 no placeholder protected route was committed), so
  `401` becomes observable from outside only once the first `/v1` route
  lands in the next TODO. T5 proved the full 401/200 matrix with a
  throwaway protected route that was deleted before committing (T5 plan
  §10).
- **`/docs` is the one real page** (when Swagger is enabled, the default).
  Swagger serves itself outside the Nest router entirely, so versioning
  never prefixes it and the API-key guard never applies to it — the UI
  stays reachable without a key. The UI lists the health probe as a `head`
  operation on `/health/ping` — deliberately left visible (T4 decision C) —
  and now carries a working **Authorize** button (T5, TODO-02 §5.3): see
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
- No committed endpoint is guard-protected at this stage (only the public
  probe is registered; G10 kept the verification placeholder route out of
  the repo), so a live `401` appears the moment the first `/v1` route lands
  in the next TODO. T5 verified the full matrix against a throwaway
  protected route before teardown (T5 plan §10).

Quick probes (PowerShell: `curl` aliases to `Invoke-WebRequest` — always use
`curl.exe`):

```powershell
curl.exe -I http://localhost:3001/health/ping   # 200, empty body — no key sent; @Public() keeps the probe open
curl.exe -i http://localhost:3001/              # 404 + helmet security headers
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/v1/health/ping   # 404 — proves the probe is not under /v1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200 — Swagger UI is not a guarded route
```

The request shape for the protected `/v1` routes of the next TODO — today
they still 404, because no such route is committed yet:

```powershell
curl.exe -i http://localhost:3001/v1/<route>                                  # 401 once <route> exists (no key)
curl.exe -i -H "x-api-key: <API_KEY value from your .env>" http://localhost:3001/v1/<route>   # passes the guard once <route> exists
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
logic or tests were created**. Consequences an agent must know today:

- `POST /v1/transactions` is still **not reachable** — it **404s** like every
  other non-health route (see
  [API behavior at this stage](#api-behavior-at-this-stage)).
- Swagger `/docs` still lists **only the health probe**; the DTOs carry full
  `@ApiProperty` metadata but nothing renders it until TODO-04 declares the
  endpoint.
- `TRANSACTIONS_RETURN_BODY` has **no runtime consumer yet** (toggle contract
  below).

| Artifact (paths under `src/`) | Role |
|-------------------------------|------|
| `transactions/dto/create-transaction.dto.ts` — `CreateTransactionDto` | Request body contract: all 7 fields required (rules below) |
| `transactions/dto/transaction-response.dto.ts` — `TransactionResponseDto` | Output shape of the `transaction` resource (masked card, string amounts) |
| `transactions/dto/receivable-response.dto.ts` — `ReceivableResponseDto` | Output shape of the `receivable` resource (json-server wire naming: `transaction_id`, `create_date`, …) |
| `transactions/dto/create-transaction-response.dto.ts` — `CreateTransactionResponseDto` | 201 envelope `{ transaction, receivable }`; documents the `TRANSACTIONS_RETURN_BODY` gate |
| `transactions/dto/validators/` | Custom constraints `IsPositiveDecimalString` and `IsFutureExpirationDate` (exact reject messages in their JSDoc) |
| `common/enums/` | `PaymentMethod` (`debit_card`/`credit_card`), `ReceivableStatus` (`paid`/`waiting_funds`) — string values **are** the wire values |
| `common/constants/payment-fee.constants.ts` | `PAYMENT_FEE_PERCENTAGES`: debit `"2"`, credit `"4"` — fee **percentage strings**, not amounts |
| `common/utils/card-number.util.ts` | `maskCardNumber()`: pure last-4-digits helper |

### What the contract guarantees (once the route is wired in TODO-04)

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
sends. The last-4-only rule is an output/persistence invariant: the future
TODO-04 service layer truncates with `maskCardNumber()`
(`src/common/utils/card-number.util.ts`) before storing to json-server and
answering; nothing stores or returns the full PAN. The helper is already in
the repo but is **not called by anything yet**.

### Envelope switch (`TRANSACTIONS_RETURN_BODY`)

Optional boolean env var, default `true`, mirroring the `SWAGGER_ENABLED`
pattern (schema + `ConfigKeys.TransactionsReturnBody` + `.env.example`; the
env table above has its row). The toggled behavior belongs to the TODO-04
controller: `true` ⇒ 201 with the full `{ transaction, receivable }` body,
`false` ⇒ bare `201 CREATED`. **Setting it today has no observable effect** —
TODO-03 ships plumbing only (user-approved global-plan §5 resolution).

### Verifying the contract today

Runtime exercises (curl against the endpoint, Swagger rendering, validator
REPL checks) are TODO-04 scope — out of scope for this cycle (TODO-03 §6:
no tests). The current green signal for the layer is that it compiles and
lints as part of the app:

```bash
npm run build   # exit 0 → DTOs, validators, enums, constants and helper compile & are importable
npm run lint    # exit 0
```

Each new file's JSDoc header records its purpose, TODO-03 section, exact
validator semantics/messages and its next consumers (TODO-04
controller/service/specs).

## External clients (TODO-04)

TODO-04 builds the two outbound HTTP clients (@nestjs/axios `HttpService`
only — no other HTTP library). **Task 1 (Numerator client) is implemented**
on branch `feat/external-clients`; **Task 2 (json-server client) and Task 3
(module registration + HTTP timeout) are pending** — everything below
describes only what exists today, and nothing executes against a live
service yet (see the registration caveat).

### Numerator client — `src/numerator/` (Task 1)

| Artifact | Role |
|----------|------|
| `numerator.service.ts` — `NumeratorService.getNextId(): Promise<string>` | The single public method: returns one unique sequential ID as a **string** (json-server string-id convention) |
| `numerator.module.ts` | Minimal `@Module` importing the **bare** `HttpModule`; exports the service. Not yet imported by `AppModule` (Task 3) |
| `numerator.constants.ts` | In-code defaults: `NUMERATOR_DEFAULT_MAX_RETRIES = 10`, `NUMERATOR_DEFAULT_BASE_BACKOFF_MS = 20`, backoff cap `MAX_NUMERATOR_BACKOFF_MS = 160`, `CAS_CONFLICT_STATUS = 400` |
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
503) is **not** this client's job — deferred to the orchestration layer
(global plan G18).

**Config flow:** all reads go through `ConfigService` + `ConfigKeys` — never
`process.env`. `NUMERATOR_API_URL` is required (`getOrThrow` in the service
constructor — Task 1 is its first consumer); `MAX_RETRIES` and
`NUMERATOR_BASE_BACKOFF_MS` are **optional** and read with
`get(key, default)`; the defaults live only in `numerator.constants.ts`, so
existing `.env` files boot unchanged (global plan G3). **Registration
caveat:** `NumeratorModule` is not in `AppModule` yet and no controller
calls the client, so `npm run start:dev` exercises none of this until
Task 3; Task 3 also upgrades the bare `HttpModule` import to the
timeout-configured form — `HttpModule.register({ timeout })`, since
`@nestjs/axios` **v4 has no `forRoot`** (implementation-plan decision
T1-D7).

### Contract exercises — curl against the Numerator mock (no docker commands from this guide)

The recipes below are transcribed from the mock source
(`numerator-api/api.js` + `numerator-api/numerator.js`) and were **not
live-verified during this docs cycle** — the services may or may not be
running. The mock is started via `docker compose up` at the repo root, but
**never run docker commands autonomously from an agent session — ask the
user** (TODO-04 §Context). If `localhost:3000` refuses connections, that
just means the service is down; the expected shapes below still document
the exact traffic `NumeratorService` will send once wired.

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

### Pending in this TODO

- **Task 2 — json-server client** (`src/json-server/`):
  `createTransaction` / `createReceivable` POSTing to `JSON_SERVER_URL`,
  transport-only payloads (no fees/masking), fail-fast error on 4xx/5xx —
  **not implemented yet**.
- **Task 3 — module registration:** import both modules in `AppModule` and
  configure the Axios timeout via `HttpModule.register` (≈3–5 s per TODO
  §Configuration & resilience) — **not done yet**; until then the app makes
  zero outbound calls.

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

Expected: **`HTTP 404`** — every other unknown route still 404s (a real reply,
not a connection error; matched routes only are guard-checked, so unknown
paths 404 rather than 401) with **helmet security headers** on the response,
and the morgan request line printed on the server console. Note: a live
**401** is not externally observable yet — the guard is active, but no
protected endpoint is committed at this stage (G10); the first `/v1` route of
the next TODO will expose it. Then:

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
  source TODO: [`.agent/todos/20260913/20260913-todo-4.md`](../.agent/todos/20260913/20260913-todo-4.md)
  §Task 1 + §"Configuration & resilience" (Task 1 portion; TODO-04 Tasks
  2–3 are still open)

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- Target architecture of the completed API (status block marks the parts
  already implemented): [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
