# json-server client — `src/json-server/` (TODO-04 Task 2)

The outbound persistence client of the external-clients TODO: it POSTs
caller-built payloads to the provided json-server mock and returns the
echoed resource. **Status (2026-09-14): implemented and wired.** Task 2
built the client on branch `feat/external-clients` (commits `c827d8b`,
`de84780`, `7af33e9`); **Task 3 registered it** (commit `7a4a149`) —
`JsonServerModule` is now imported by `AppModule`, and its `HttpModule`
import carries the shared timeout via
`HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (`HTTP_TIMEOUT_MS = 4000`,
`src/common/constants/http-timeout.constants.ts`) on a per-module isolated
axios instance (T3-D2; v4 has no `forRoot` — T1-D7/T3-D1). So today a
`JsonServerService` instance **is constructed at boot** and is injectable
app-wide (DI verified by the plan's `DI-SANITY-OK` check recorded in the
Task 3 adherence evidence). It still performs **zero outbound calls at
runtime** only because no orchestration endpoint invokes it yet. Unit/e2e
tests for this client are deferred to a later TODO. Parent runbook:
[`app-setup.md`](app-setup.md) ("External clients (TODO-04)").

## Table of Contents

- [What it does](#what-it-does)
- [What it does NOT do (transport-only)](#what-it-does-not-do-transport-only)
- [Endpoints](#endpoints)
- [Payload shapes (TODO-04 §2.4)](#payload-shapes-todo-04-24)
- [Response](#response)
- [Failure model](#failure-model)
- [Privacy rule — payloads are never logged](#privacy-rule--payloads-are-never-logged)
- [Configuration](#configuration)
- [Wiring status — registered with timeout](#wiring-status--registered-with-timeout)
- [Contract exercise — curl against the mock](#contract-exercise--curl-against-the-mock)
- [References](#references)

## What it does

`JsonServerService` (`src/json-server/json-server.service.ts`) exposes
exactly two injectable methods (TODO-04 §2.1):

```ts
createTransaction(payload: CreateTransactionPayload): Promise<TransactionResponseDto>
createReceivable(payload: CreateReceivablePayload): Promise<ReceivableResponseDto>
```

Each POSTs the payload **verbatim** to one json-server collection via
`@nestjs/axios` `HttpService` (+ `firstValueFrom`) and resolves with the
response body json-server echoes back. `HttpService` and `ConfigService`
are constructor-injected; the base URL is read once at construction.

## What it does NOT do (transport-only)

TODO-04 §2.4 is explicit: "The client itself does not calculate fees or mask
card numbers; it only transports the data it receives." Concretely:

- **No id generation** — both payloads carry a caller-supplied `id` string
  (the orchestration layer gets it from `NumeratorService`, §2.2).
- **No fee math** — `discount` (fee percentage string "2"/"4") and `total`
  arrive pre-computed upstream.
- **No card masking** — `cardNumber` must already be the last-4 value
  (produced by `maskCardNumber()`, `src/common/utils/card-number.util.ts`,
  in the future service layer).
- **No field defaulting** — even `create_date` is caller-owned
  (ISO-8601 recommended per §2.4; the seed's DD/MM/YYYY format discrepancy
  is an upstream business decision, not a client concern).
- **No retries** — every failure aborts immediately (fail-fast; retry
  policy for json-server calls is explicitly out of scope for TODO-04).
- **No HTTP-response mapping** — translating failures into route responses
  is the orchestration layer's job (global-plan decision G18).
- **No route** — the service only transports; controllers arrive in later
  TODOs (the module itself has been registered in `AppModule` by TODO-04
  Task 3 — see [Wiring status](#wiring-status--registered-with-timeout)).

## Endpoints

| Method | Path                          | Service method      |
|--------|-------------------------------|---------------------|
| POST   | `{JSON_SERVER_URL}/transactions` | `createTransaction` |
| POST   | `{JSON_SERVER_URL}/receivables`  | `createReceivable`  |

The collection names are the constants `TRANSACTIONS_RESOURCE_PATH` /
`RECEIVABLES_RESOURCE_PATH` (`src/json-server/json-server.constants.ts`).
Upstream is the compose service `json-server` (image
`vimagick/json-server`, command `json-server -h 0.0.0.0 -p 8080
/config/db.json`, port `8080` — see `docker-compose.yml`), seeded by
`config/db.json`.

## Payload shapes (TODO-04 §2.4)

Transport types live in `src/json-server/interfaces/`. Field sets match
`config/db.json` verbatim: string ids, string amounts, masked 4-digit card
numbers, snake_case receivable fields.

**`CreateTransactionPayload`** → `POST /transactions`:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | From the Numerator API (json-server string-id convention) |
| `value` | `string` | Amount, e.g. `"340.50"` |
| `description` | `string` | As received from the client |
| `method` | `PaymentMethod` | Wire values `debit_card` / `credit_card` (matches seed) |
| `cardNumber` | `string` | **Already masked** to last 4 digits |
| `cardHolderName` | `string` | As received |
| `cardExpirationDate` | `string` | `MM/YY` as received |
| `cardCvv` | `string` | As received |

**`CreateReceivablePayload`** → `POST /receivables`:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | From the Numerator API (second id of the pair) |
| `transaction_id` | `string` | Originating transaction id |
| `status` | `ReceivableStatus` | `paid` (debit, D+0) / `waiting_funds` (credit) — mapped upstream |
| `create_date` | `string` | Caller-supplied; ISO-8601 recommended per §2.4 |
| `subtotal` | `string` | Same value as the transaction |
| `discount` | `string` | Fee **percentage** ("2" debit / "4" credit) — user decision, see `brief.md` §3.2 |
| `total` | `string` | Net amount — computed upstream |

## Response

json-server answers a successful collection POST with **201** echoing the
created object. The client does **not** assert the status code (plan
decision T2-D3): success is any resolved axios response, and
`response.data` is returned as-is, typed `TransactionResponseDto` /
`ReceivableResponseDto`. Those DTOs are imported **type-only** (global plan
G11) — this module has no runtime dependency on `src/transactions`.

## Failure model

Any POST failure throws `JsonServerRequestError`
(`src/json-server/errors/json-server.errors.ts`) — fail-fast, no retries:

| Cause | `status` field | Message `reason` |
|---|---|---|
| 4xx / 5xx response | the HTTP status | axios-generated text, e.g. `Request failed with status code 400` |
| Network / timeout / DNS failure | `undefined` (no response existed) | axios-generated text |
| Any non-axios thrown value | `undefined` | `String(error)` / `error.message` |

The message is built ONLY from `resource`, `status` and the axios reason —
**upstream response bodies are never interpolated** (they are not a stable
contract and could echo payload content; plan decision T2-D7). Callers
discriminate on `error.status === undefined` (transport failure) vs. an
HTTP status (upstream rejection). Mapping these to 5xx/4xx route responses
belongs to the orchestration layer, not this client (global plan G18).

## Privacy rule — payloads are never logged

Payloads carry card data (holder name, expiration, CVV). The client's only
log line is one `warn` on failure naming the resource and the HTTP status
(or "no HTTP status") — success paths log **nothing**, request bodies and
upstream error bodies never reach a log or an error message (TODO-04
§Configuration & resilience, global plan G13). Callers and anything layered
on top must keep this invariant.

## Configuration

- Base URL: env `JSON_SERVER_URL` — already required, validated at
  bootstrap (`@IsUrl` with protocol, plan addendum A4-R) and present in
  `.env.example`. **Task 2 added no new configuration.**
- Read via `ConfigService.getOrThrow(ConfigKeys.JsonServerUrl)` in the
  constructor — never `process.env`, never literal key strings.
- Trailing slashes are stripped once at construction (`http://host:8080/`
  ⇒ `http://host:8080`), so resource URLs can never double-slash (plan
  decision T2-D1).

## Wiring status — registered with timeout

`JsonServerModule` is **registered in `AppModule`** (TODO-04 Task 3, commit
`7a4a149`, G14) and imports `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })`
— `@nestjs/axios` v4 has no `forRoot` (T1-D7), and `register` gives this
module its own isolated axios instance carrying the 4 s timeout
(`HTTP_TIMEOUT_MS = 4000` from `src/common/constants/http-timeout.constants.ts`),
separate from the Numerator client's instance (T3-D2). `JsonServerService`
boots with the app and is injectable anywhere (evidence: the Task 3 plan's
temp DI-sanity script, `DI-SANITY-OK`, recorded in the adherence-report
step — not a file in the repo). The future Transactions module simply adds
`JsonServerModule` to its `imports`. With no orchestration endpoint yet,
nothing calls the service, so the app still sends zero outbound requests.

## Contract exercise — curl against the mock

Transcribed from `config/db.json`/docker-compose and json-server's documented
echo behavior; **not live-verified during this docs cycle**. Services start
with `docker compose up` at the repo root — an agent must **ask the user** to
run docker (TODO-04 §Context), never run it autonomously. PowerShell
(always `curl.exe`):

```powershell
# 1) Current store shape — read-only, e.g. [{"id":"1","value":"100", ...}, ...]
curl.exe -s http://localhost:8080/transactions

# 2) Create with a caller-supplied string id — json-server answers 201
#    echoing the created object (exactly the traffic createTransaction sends)
curl.exe -s -X POST http://localhost:8080/transactions `
  -H "Content-Type: application/json" `
  -d '{\"id\":\"9\",\"value\":\"340.50\",\"description\":\"T-Shirt Black/M\",\"method\":\"debit_card\",\"cardNumber\":\"4455\",\"cardHolderName\":\"Charles Le Clerc\",\"cardExpirationDate\":\"09/29\",\"cardCvv\":\"998\"}'
```

State mutation warning: call 2 adds a record to the running container's
store (the compose command has **no** `--watch` flag, so file persistence
must not be assumed — treat it as live-until-restart). Use ids that cannot
collide with existing ones ("1"–"3" are seeded), and never send real card
data into the mock.

## References

- Source TODO: [`.agent/todos/20260913/20260913-todo-4.md`](../.agent/todos/20260913/20260913-todo-4.md) §Task 2 (§2.1–§2.4) + "Out of scope" + "Configuration & resilience"
- Implementation plan (decisions T2-D1…T2-D13): [`.kilo/plans/20260913-jsonserver-client.md`](../.kilo/plans/20260913-jsonserver-client.md)
- TODO-04 global plan (G8, G10–G14, G18): [`.kilo/plans/20260913-external-clients.md`](../.kilo/plans/20260913-external-clients.md)
- Numerator client guide (sibling client; IDs come from here): [`app-setup.md`](app-setup.md) → "External clients (TODO-04)"
- DTO/shape origin: TODO-03 "DTO & validation layer" in [`app-setup.md`](app-setup.md)
