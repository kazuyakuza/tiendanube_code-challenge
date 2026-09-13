# Architecture — Orchestration API (PLANNED)

> STATUS: **Planned, not yet implemented.** `src/` is empty. This document
> describes the target design that follows `brief.md` §6. Update after
> implementation.
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

## Modular NestJS Layout (target)

```text
src/
├── config/                 # Validated environment config (implemented, T2)
│   ├── config.keys.ts      # ConfigKeys: canonical env key names for ConfigService
│   └── env.validation.ts   # class-validator schema + fail-fast validateEnv()
├── common/                 # Cross-cutting concerns
│   ├── guards/             # ApiKeyGuard (x-api-key header)
│   ├── filters/            # Global exception filter (structured errors)
│   └── interceptors/       # Logging/response conventions
├── health/                 # HEAD /health/ping — public liveness probe
├── transactions/           # Main orchestration module
│   ├── dto/                # CreateTransactionRequest, response DTOs
│   ├── transactions.controller.ts
│   ├── transactions.service.ts
│   └── fee-rules.ts        # debit/credit fee map + date/status policy
├── numerator/              # Numerator API client + CAS retry logic
├── json-server/            # json-server HTTP client (transactions/receivables)
├── main.ts                 # Bootstrap: helmet, CORS, morgan, versioning, Swagger
└── app.module.ts           # Wires all modules
```

## Request Data Flow — POST /v1/transactions

1. **Guard**: `ApiKeyGuard` validates `x-api-key` (health stays public).
2. **Validation**: DTO pipes validate payload (value, description, method,
   cardNumber, cardHolderName, cardExpirationDate MM/YY, cardCvv).
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
    from `currentNumerator`.
- **Algorithm** (per requested ID):
  1. `GET /numerator` → current value N (also returned in the 400 body).
  2. `PUT /numerator/test-and-set { oldValue: N, newValue: N + 1 }`.
  3. On 400: set `N = body.currentNumerator`, retry step 2.
  4. Max attempts (e.g. 5) with short exponential backoff (e.g. 50ms base);
     exhaust → 503 structured error.
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
