# Implementation Plan — Task 1: Initialize Project Info (step 4.1b)

TODO source: `.agent/todos/20260913/20260913-todo-1.md`
Approved global plan: `.kilo/plans/20260913-initialize-project-info.md`
Executor for this plan: **docs-specialist** (step 4.2). Markdown files ONLY. No code, no installs, no changes to `numerator-api/`, `config/`, `docker-compose.yml`, READMEs, `AGENTS.md`.

## Scope (fixed)

1. Targeted fix of `.agent/project-info/brief.md` §3.2 Fee Rules (user decision 2026-09-13): `discount` = fee **percentage**, `total` = subtotal × (1 − discount/100). Nothing else in `brief.md` changes; the `<!-- DO NOT DELETE ... -->` section must remain byte-identical.
2. Create 4 new files in `.agent/project-info/`: `product.md`, `context.md`, `architecture.md`, `tech.md` — content exactly as specified in sections 3–6 below.
3. `git rm .agent/project-info/.initialized` (tracked file).
4. Stage exactly the 6 resulting paths and commit with the message in section 9.

Out of scope (downstream steps, do NOT do here): root `AGENTS.md` link updates (step 4.4), TODO `[DONE]` marking (4.6), branch ops (step 2 already done — work happens on `feat/initialize-project-info`), push (step 5).

## Working rules for the implementer (docs-specialist)

- Use the `write` tool for new files and the `edit` tool for `brief.md` — real newlines, never literal `\n` (Newline Prevention Rule).
- Every new file ≤ 200 lines (Max Lines per File rule applies as a hard cap here).
- Use only the exact text in sections 3–6. You may fix a typo if you introduce one, but you may NOT rephrase, reorder, add or remove sections.
- Gitignore compliance: before commit run `git status`; nothing staged may match `.gitignore` (none of these paths do; `.env` files are ignored but not part of this task).

---

## 1. Pre-reads (do first, in order)

Read these before any edit (no output required, just context):

1. `.agent/project-info/instructions.md`
2. `.agent/project-info/brief.md`
3. `README.md`, `config/db.json`, `numerator-api/numerator.js`, `docker-compose.yml`

## 2. Edit `.agent/project-info/brief.md` (targeted fix)

Locate lines 54–55 (inside `#### Fee Rules`, after the payment-method table, before the masking bullet). Exact strings:

OLD (both lines, one `edit` call):

```
- `discount` = fee amount (not percentage)
- `total` = `subtotal - discount`
```

NEW:

```
- `discount` = fee percentage (debit_card → "2", credit_card → "4", stored as string)
- `total` = `subtotal × (1 − discount/100)` (fee deducted from the transaction total)
```

No other change in the file. Verify afterward with a read of lines 45–60: the fee table, the masking bullet and the `<!-- DO NOT DELETE NEXT SECTION -->` marker must be untouched.

## 3. Create `.agent/project-info/product.md` (NEW)

Write EXACTLY this content (91 lines):

```markdown
# Product — Orchestration API

## Problem Definition

Merchants sell through a storefront and get paid by card. Every card sale creates
two records that must stay consistent:

- A **transaction**: the customer-facing charge (amount, description, payment method, card data).
- A **receivable**: the merchant-facing payout (what the merchant receives after the platform fee).

Today there is no service that creates both in one operation. The Orchestration API
solves this: one authenticated call creates the transaction and its corresponding
receivable atomically-like, applying fee rules and guaranteeing unique IDs.

## Merchant-Facing Flow

1. Merchant submits a payment: amount, description, payment method (`debit_card` or
   `credit_card`), card number, cardholder name, expiration date (MM/YY) and CVV.
2. API validates the payload (DTO validation, 422 on invalid input).
3. API obtains 2 unique sequential IDs from the Numerator API (one for the
   transaction, one for the receivable) BEFORE any write, so no orphan records exist.
4. API creates the transaction in json-server.
5. API computes the fee and creates the receivable in json-server.
6. API returns both resources in one consistent response.

## Fee Rules

| Payment Method | Fee  | Receivable Status | Payment Date       |
|----------------|------|-------------------|--------------------|
| `debit_card`   | 2%   | `paid`            | Same day (D+0)     |
| `credit_card`  | 4%   | `waiting_funds`   | Creation + 30 days |

- `discount` holds the **fee percentage** as a string: `"2"` for debit_card, `"4"`
  for credit_card (matches the seed data in `config/db.json`).
- `total` = `subtotal × (1 − discount/100)`. Example: subtotal "340.50",
  discount "2" → total "333.69" (340.50 × 0.98).
- The fee is calculated based on the transaction's total amount.

## Privacy & Masking

- The card number is sensitive information: only the **last 4 digits** may be
  stored and returned (seed data already stores masked values like "3486").
- Full card data is accepted in the request but never persisted beyond the mask.

## Success Criteria

1. **Atomicity-like consistency**: both the transaction and the receivable are
   created from a single request; both IDs are reserved before any insert.
2. **Unique sequential IDs**: generated only via the Numerator API (never UUID),
   safe under concurrent requests (test-and-set + retries).
3. **Correct fee math**: discount/total follow the fee rules table for each method.
4. **Data privacy**: card numbers stored and returned masked (last 4 digits).
5. **Production readiness**: validated config, security hardening, HTTP logging,
   OpenAPI docs, unit + e2e tests.
```

## 4. Create `.agent/project-info/context.md` (NEW)

Write EXACTLY this content (60 lines):

```markdown
# Context — Current State

[Project Info: Active]

## Current Work Focus

Bootstrapping the project information set and the NestJS application defined in
`brief.md`. No application code exists yet: `src/` contains only `.gitkeep`.

## Recent Changes

- 2026-09-13: Project info initialized. Created `product.md`, `context.md`,
  `architecture.md`, `tech.md`; removed `.initialized` marker; fixed
  `brief.md` §3.2 Fee Rules.
- 2026-09-13: USER DECISION — `discount` is the **fee percentage**
  (debit_card → "2", credit_card → "4", stored as string), not a fee amount.
  `total` = `subtotal × (1 − discount/100)`. `brief.md` was corrected accordingly.

## Recorded Facts

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

1. Scaffold the NestJS app per `brief.md` §6 structure (modules: `config`,
   `common`, `health`, `transactions`, `numerator`, `json-server`).
2. Configure environment validation (`@nestjs/config` + class-validator) for
   `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `NODE_ENV`.
3. Implement Numerator client with test-and-set CAS retry loop (see
   `architecture.md`).
4. Implement `POST /v1/transactions` orchestration + receivable fee rules.
5. Add security (helmet, CORS, API key guard), morgan logging, Swagger at `/docs`.
6. Unit + e2e tests (Jest + Supertest).
```

Note for the implementer: the bracketed line under "## Recorded Facts" third bullet in the README-discrepancy paragraph is intentionally self-explanatory; keep it verbatim.

## 5. Create `.agent/project-info/architecture.md` (NEW)

Write EXACTLY this content (146 lines):

```markdown
# Architecture — Orchestration API (PLANNED)

> STATUS: **Planned, not yet implemented.** `src/` is empty. This document
> describes the target design that follows `brief.md` §6. Update after
> implementation.

## Modular NestJS Layout (target)

```text
src/
├── config/                 # Validated environment config
│   ├── configuration.ts    # Loads .env values into a typed object
│   └── validation.ts       # class-validator schema for env vars
├── common/                 # Cross-cutting concerns
│   ├── guards/             # ApiKeyGuard (x-api-key header)
│   ├── filters/            # Global exception filter (structured errors)
│   └── interceptors/       # Logging/response conventions
├── health/                 # GET /health/ping — public liveness probe
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
```

Note for the implementer: the fenced block inside section "Modular NestJS Layout" is a fenced code block nested in the markdown file; use triple backticks as shown (the outer document is not fenced — write the file literally as displayed, with the inner block delimited by ```text ... ```).

## 6. Create `.agent/project-info/tech.md` (NEW)

Write EXACTLY this content (92 lines):

```markdown
# Tech — Stack, Setup & Constraints

## Stack (per brief.md §2)

| Concern      | Choice                                  |
|--------------|-----------------------------------------|
| Runtime      | Node.js (LTS) + TypeScript              |
| Framework    | NestJS (latest stable)                  |
| HTTP Client  | Axios via `@nestjs/axios`               |
| Config       | `@nestjs/config` + class-validator      |
| Validation   | `class-validator` + `class-transformer` |
| Logging      | `morgan`                                |
| Security     | `helmet` + CORS + API Key guard         |
| Versioning   | URI versioning (`/v1/...`)              |
| Docs         | Swagger (`@nestjs/swagger`), UI `/docs` |
| Testing      | Jest (unit) + Supertest (e2e)           |

## External Services (provided, via docker compose)

| Service       | URL                     | Notes                                   |
|---------------|-------------------------|-----------------------------------------|
| json-server   | `http://localhost:8080` | Fake DB: transactions + receivables     |
| Numerator API | `http://localhost:3000` | Unique sequential ID generation (mock)  |

- `json-server`: image `vimagick/json-server`, serves `config/db.json`.
- `numerator-api`: image `node:20-alpine`, runs `yarn install && node api.js`
  inside `numerator-api/` (dependencies vendored by the container, not committed).
- `tcpdump` sidecar: ngrep capture of port 8080 traffic (debug aid).

## Environment Variables (planned `.env`)

| Variable            | Purpose                        | Example                  |
|---------------------|--------------------------------|--------------------------|
| `PORT`              | App listen port                | `3001`                   |
| `NUMERATOR_API_URL` | Numerator base URL             | `http://localhost:3000`  |
| `JSON_SERVER_URL`   | json-server base URL           | `http://localhost:8080`  |
| `API_KEY`           | Key for `x-api-key` guard      | (local secret)           |
| `NODE_ENV`          | Environment name               | `development`            |

`.env` files are gitignored (see `.gitignore`); never commit secrets.

## Development Setup Commands

1. Start provided services (repo root):
   `docker compose up`
2. Create the app (once scaffolding starts):
   `nest new` is NOT required — scaffold `src/` manually per `brief.md` §6 with
   a root `package.json` managed by npm.
3. Install app dependencies (after root `package.json` exists):
   `npm install`
4. Run the app (after scaffold):
   `npm run start:dev`

## Package Manager Note

- The `numerator-api/` container uses yarn internally; the application code
  uses **npm** (`package-lock.json`). Do not mix managers in the app root.

## Tooling Constraints (project rules — see `.kilo/rules/`)

- Max 200 lines per source file (ideally ≤ 125 excluding blanks/comments/imports).
- Max 50 lines per method body; max indentation depth 2 (extract helpers).
- Max 2 function parameters; more → encapsulate in a typed param object (new file).
- Members private by default; self-documenting names; no commented-out code.
- No global installs; project-local dependencies only.
- All source code lives in `src/`; keep `.agent/project-structure.md` updated.
```

## 7. Remove `.agent/project-info/.initialized`

File is tracked in git. Run exactly:

```
git rm .agent/project-info/.initialized
```

If git reports the file untracked (not expected), STOP and return a question to the caller instead of improvising.

## 8. Stage & verify before commit

1. `git status` — verify the modified/added/deleted set is EXACTLY:
   - modified: `.agent/project-info/brief.md`
   - new file: `.agent/project-info/product.md`
   - new file: `.agent/project-info/context.md`
   - new file: `.agent/project-info/architecture.md`
   - new file: `.agent/project-info/tech.md`
   - deleted: `.agent/project-info/.initialized`
2. Nothing else may appear. If extra paths show up, STOP and return a question.
3. Line-count check: `product.md` ≤ 200 lines, `context.md` ≤ 200, `architecture.md` ≤ 200, `tech.md` ≤ 200.

## 9. Commit

Stage explicitly (never `git add .`):

```
git add .agent/project-info/brief.md .agent/project-info/product.md .agent/project-info/context.md .agent/project-info/architecture.md .agent/project-info/tech.md
```

(`.initialized` deletion is already staged by `git rm`.)

Commit (exact message):

```
git commit -m "docs(project-info): initialize product, context, architecture and tech files; fix brief fee rules"
```

## 10. Post-commit verification

1. `git show --stat HEAD` — confirm the 6 paths above in the single commit.
2. Read `brief.md` lines 45–60 — confirm fee-table and `<!-- DO NOT DELETE ... -->` section intact.
3. Confirm `.agent/project-info/` now contains exactly: `brief.md`, `instructions.md`, `product.md`, `context.md`, `architecture.md`, `tech.md` (no `.initialized`).

## Completion signal

Return a summary: files created/edited (with paths), `git rm` result, commit hash, and anything NOT done (AGENTS.md links — deferred to step 4.4).
