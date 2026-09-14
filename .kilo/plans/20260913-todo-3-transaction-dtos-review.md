# Code Review — Cycle TD (TODO-03 Transaction DTOs & Validation)

## Verified OK (no action required)

- `CreateTransactionDto` contains all seven required request fields; no per-DTO `ValidationPipe` options were added.
- `value` validation rejects `"0"`, `"0.00"`, negatives, non-numeric input, and >2 decimal places via `IsPositiveDecimalString`.
- `method` is restricted to `PaymentMethod` via `@IsEnum` and documented with `enum: PaymentMethod`.
- `cardExpirationDate` enforces `MM/YY` via `@Matches` and future-date validity via `IsFutureExpirationDate` (UTC calendar comparison, end-of-month semantics, impossible months rejected).
- `cardCvv` enforces 3–4 digits; `cardNumber` enforces 13–19 digits.
- Shared enums and fee constants are in `src/common/enums/` and `src/common/constants/` with the correct `"2"` / `"4"` string values.
- `maskCardNumber` is a pure helper returning only the last 4 characters.
- Response DTOs contain no `class-validator` decorators and have full `@ApiProperty` annotations; envelope shape is `{ transaction, receivable }`.
- `ReceivableResponseDto.create_date` documents the ISO-8601 format and the seed-data discrepancy.
- `TRANSACTIONS_RETURN_BODY` env plumbing mirrors `SWAGGER_ENABLED` (optional boolean, default `true`), `ConfigKeys.TransactionsReturnBody` matches the env var name, `.env.example` and `docs/app-setup.md` are updated, and `.env` is not staged.
- `main.ts` and `app.module.ts` are unchanged.
- `20260913-todo-4.md` and `20260913-todo-5.md` are untracked and not staged.

## Findings

### 1. Scope creep / misleading JSDoc in existing controller — `src/health/health.controller.ts` (critical)

**What changed:** The TODO-03 branch modified an existing controller. The `ping()` JSDoc curl example was changed from `http://localhost:3001/health/ping` to `http://localhost:30001/health/ping`, and the empty method body was reformatted from `ping(): void {}` to `ping(): void { }`.

**Why it matters:** Controllers are explicitly out of scope for this TODO. The `30001` port contradicts `.env.example` and `docs/app-setup.md`, so the example is misleading.

**Fix:**
- Revert the JSDoc line to:
  ```text
   *   curl -I http://localhost:3001/health/ping
  ```
- Revert the body to `ping(): void {}` unless the linter enforces the space; in that case leave the formatting and only fix the port.

### 2. Scope creep in project metadata — `package.json` / `package-lock.json` (critical)

**What changed:** `package.json` gained three Docker scripts (`docker:start`, `docker:start-bkg`, `docker:ms-logs`) and the Jest `moduleFileExtensions` / `collectCoverageFrom` arrays were reformatted. `package-lock.json` was regenerated.

**Why it matters:** Docker scripts and lockfile churn are unrelated to the DTO/validation task and expand the change surface beyond the approved plan.

**Fix:**
- Keep the version bump at `0.2.0`.
- Remove the three `docker:*` scripts from `package.json`.
- Restore the original compact arrays for `moduleFileExtensions` and `collectCoverageFrom`.
- Ensure `package-lock.json` contains only the `0.1.0` → `0.2.0` version changes and no dependency modifications.

### 3. Sensitive-looking full card number in Swagger example — `src/transactions/dto/create-transaction.dto.ts` (major)

**What changed:** The `cardNumber` `@ApiProperty` example is `5221456987541203`, a plausible full PAN.

**Why it matters:** The security review criteria forbid secret values in examples, and Swagger will render a full card number.

**Fix:** Replace the example with a well-known public test PAN:

```ts
@ApiProperty({
  description: 'Full card number as received from the client (13–19 digits). Only the last 4 digits are ever stored or returned.',
  example: '4111111111111111',
})
```

Optionally update `TransactionResponseDto.cardNumber` example to `'1111'` so the request/response examples stay consistent.

## Planner adjudication (4.3 gate, 2026-09-13)

- **Finding 1 — REJECTED as fix (accepted deviation).** The `health.controller.ts` change is a pre-existing USER edit committed per Critical Workflow step 2 ("commit unstaged files with a meaningful message"); global plan §2.1 records it as committed-as-is and flagged (possible `30001` typo) but explicitly not reverted. Reverting user work inside a feat branch would violate the preserve-existing-code rule; surface to the user in the final summary instead.
- **Finding 2 — REJECTED as fix (accepted deviation).** Same rationale: `package.json` docker scripts + array reformatting were user edits checkpointed in step 2 (commit 30eb63f, landed on `main`); lockfile churn beyond that is limited to the sanctioned `npm version 0.2.0` (step 3, commit 5889043). Do not touch.
- **Finding 3 — ACCEPTED.** Schedule in sub-step 4.3-fix: request example → `'4111111111111111'` (public documentation test PAN) and `TransactionResponseDto.cardNumber` example → `'1111'` for request/response consistency. This is the ONLY 4.3-fix content.
- Simplifier side: `SIMPLIFICATION PLAN: NONE`; DEFER items D1/D2 acknowledged and deferred to future TODOs (no action in this cycle).
