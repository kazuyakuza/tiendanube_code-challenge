# Implementation Plan — Cycle TD (TODO 03, Tasks 1–4): Transaction DTOs & Validation

- **Source TODO**: `.agent/todos/20260913/20260913-todo-3.md` (§§ Task 1–4; Tasks 5–7 are constraints)
- **Binding global plan**: `.kilo/plans/20260913-todo-3-transaction-dtos.md` (decisions G1–G11, §2.4 resolution, §5)
- **Executor**: JUNIOR implementer under 50% restriction — follow the steps LITERALLY, in order. Do not add files, do not rename things, do not "improve" snippets. If a step is ambiguous, STOP and ask the caller.
- **Branch**: `feat/transaction-dtos` already exists and is checked out (step 2 done). Version already `0.2.0` (step 3 done). **Do NOT create branches, do NOT bump versions, do NOT push, do NOT merge.**

---

## 0. Scope

### In scope (exactly this, nothing else)

1. Shared enums `PaymentMethod`, `ReceivableStatus` (`src/common/enums/`)
2. Fee-percentage constants (`src/common/constants/payment-fee.constants.ts`)
3. Pure helper `maskCardNumber` (`src/common/utils/card-number.util.ts`)
4. Two custom validators (`src/transactions/dto/validators/`)
5. Request DTO `CreateTransactionDto` (full `class-validator` + `@ApiProperty`)
6. Response DTOs `TransactionResponseDto`, `ReceivableResponseDto`, `CreateTransactionResponseDto`
7. `TRANSACTIONS_RETURN_BODY` env plumbing (env schema, ConfigKeys, `.env.example`, local `.env`, one docs table row, JSDoc pointer on the envelope DTO)
8. `.agent/project-structure.md` folder map update

### OUT OF SCOPE — HARD BLOCKS (never do these)

- No controller, no NestJS module wiring (`app.module.ts` untouched), no `main.ts` edits
- No Numerator/json-server calls, no fee arithmetic, no ID generation, no persistence
- No unit/e2e tests, no new npm dependencies
- NEVER stage: `.env`, `node_modules/`, `dist/`, `coverage/`, `.agent/todos/20260913/20260913-todo-4.md` (user-owned), anything matching `.gitignore`
- No code comments beyond the JSDoc headers specified in the snippets (self-documenting code rule)

### Style rules that apply to every file (from `.kilo/rules/`)

- File ≤ 200 lines (target ≤ 125 code lines); method body ≤ 50 lines; max 2 params per method; max nesting depth 2; single-section boolean conditions (extract named helpers for compound conditions); public members only for DTO/enum data holders (documented exception, same precedent as `EnvironmentVariables`); no commented-out code; real newlines (never literal `\n` in file content).

---

## Step 0 — Checkpoint: commit plan files

Working tree currently has two untracked plan files. Commit them FIRST so the code commits are clean.

```powershell
git status
git add .kilo/plans/20260913-todo-3-transaction-dtos.md .kilo/plans/20260913-todo-3-transaction-dtos-impl.md
git status
```

Verify `20260913-todo-4.md`, `.env`, `node_modules/` are NOT staged. Then:

```powershell
git commit -m "docs(plans): add TODO-03 global plan and cycle TD implementation plan"
```

---

## Step 1 — Shared enums + fee constants

### 1.1 Create `src/common/enums/payment-method.enum.ts` (exact content)

```ts
/**
 * Payment methods accepted by `POST /v1/transactions` (TODO-03 §3).
 *
 * Shared by the request DTO (`method` field), the transaction response DTO
 * and the fee constants (`src/common/constants/payment-fee.constants.ts`).
 * String-valued so the wire format matches the json-server seed
 * (`config/db.json`: `"debit_card"` / `"credit_card"`).
 */
export enum PaymentMethod {
  DEBIT_CARD = 'debit_card',
  CREDIT_CARD = 'credit_card',
}
```

### 1.2 Create `src/common/enums/receivable-status.enum.ts` (exact content)

```ts
/**
 * Lifecycle status of a receivable (TODO-03 §3).
 *
 * `paid` — debit_card receivables, settled same day (D+0).
 * `waiting_funds` — credit_card receivables, settled 30 days after creation.
 * String values match the json-server seed (`config/db.json`).
 */
export enum ReceivableStatus {
  PAID = 'paid',
  WAITING_FUNDS = 'waiting_funds',
}
```

### 1.3 Create `src/common/constants/payment-fee.constants.ts` (exact content)

```ts
/**
 * Payment fee percentages per method (TODO-03 §3, brief §3.2 USER DECISION).
 *
 * `discount` is stored/persisted as the fee PERCENTAGE as a string
 * (debit_card → "2", credit_card → "4"), NOT as a fee amount. The later
 * business-logic TODO computes `total = subtotal × (1 − discount/100)`.
 */
import { PaymentMethod } from '../enums/payment-method.enum';

export const PAYMENT_FEE_PERCENTAGES: Readonly<Record<PaymentMethod, string>> = {
  [PaymentMethod.DEBIT_CARD]: '2',
  [PaymentMethod.CREDIT_CARD]: '4',
};
```

### 1.4 Commit checkpoint

```powershell
git add src/common/enums/payment-method.enum.ts src/common/enums/receivable-status.enum.ts src/common/constants/payment-fee.constants.ts
git status
git commit -m "feat(common): add payment method/receivable status enums and fee percentage constants"
```

---

## Step 2 — Card number masking helper

### 2.1 Create `src/common/utils/card-number.util.ts` (exact content)

```ts
/**
 * Pure card-number masking helper (TODO-03 §4).
 *
 * Returns ONLY the last 4 characters of the full card number — the format
 * json-server stores and the response DTO returns (brief §3.2: masked card
 * number). Request-side validation lives in `CreateTransactionDto`; this
 * function performs no validation. Unit tests arrive in a later TODO.
 */
const MASKED_DIGIT_COUNT = 4;

export function maskCardNumber(fullCardNumber: string): string {
  return fullCardNumber.slice(-MASKED_DIGIT_COUNT);
}
```

### 2.2 Commit checkpoint

```powershell
git add src/common/utils/card-number.util.ts
git status
git commit -m "feat(common): add maskCardNumber helper keeping only last 4 digits"
```

---

## Step 3 — Custom validators

### 3.1 Create folder `src/transactions/dto/validators/`

### 3.2 Create `src/transactions/dto/validators/is-positive-decimal-string.validator.ts` (exact content)

Semantics (global plan G5): string of digits, optional decimal part of 1–2 digits; strictly positive — `"0"` and `"0.00"` are rejected; negatives, empty, letters, `"+5"`, `"1."`, `"0.001"` (3 decimals) are all rejected.

```ts
/**
 * Custom validator: positive decimal string (TODO-03 §1.3, global plan G5).
 *
 * Accepts `"250.00"`, `"100"`, `"0.5"`; rejects `"0"`, `"0.00"`, `"-5"`,
 * `"abc"`, `""`, `"1.234"` (more than 2 decimal places). Regex anchors the
 * whole string, so embedded whitespace or sign characters fail the match.
 */
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const POSITIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

@ValidatorConstraint({ name: 'IsPositiveDecimalString', async: false })
export class IsPositiveDecimalStringConstraint implements ValidatorConstraintInterface {
  validate(rawValue: unknown): boolean {
    if (typeof rawValue !== 'string') {
      return false;
    }
    return isStrictlyPositiveDecimal(rawValue);
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must be a positive decimal string with at most 2 decimal places (e.g. "250.00"); zero and negatives are not allowed`;
  }
}

function isStrictlyPositiveDecimal(rawValue: string): boolean {
  if (!POSITIVE_DECIMAL_PATTERN.test(rawValue)) {
    return false;
  }
  return Number.parseFloat(rawValue) > 0;
}

export function IsPositiveDecimalString(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalStringConstraint,
    });
  };
}
```

### 3.3 Create `src/transactions/dto/validators/is-future-expiration-date.validator.ts` (exact content)

Semantics (global plan G5 + caller instruction): `MM/YY`; an expiration is valid if its calendar month/year is **not in the past** — end-of-month semantics, i.e. `04/28` is valid through 30 Apr 2028; `09/26` (current month at plan time, Sept 2026) is STILL valid; `08/26` is expired. Comparison is timezone-free: UTC calendar values only (`getUTCFullYear`, `getUTCMonth`). Format check `^\d{2}/\d{2}$` stays as a separate `@Matches` on the DTO; this validator additionally rejects impossible months like `"13/28"`.

```ts
/**
 * Custom validator: `MM/YY` card expiration date that has not expired
 * (TODO-03 §1.3, global plan G5).
 *
 * End-of-month semantics: the card is valid through the LAST DAY of the
 * expiration month, so the check is a timezone-free UTC calendar comparison
 * `expiration (month, year) >= current (month, year)`. `"04/28"` is valid
 * through 30 Apr 2028. Impossible months (`"13/28"`, `"00/28"`) are rejected.
 */
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const MM_YY_PATTERN = /^(\d{2})\/(\d{2})$/;
const MONTHS_IN_YEAR = 12;
const TWO_DIGIT_YEAR_BASE = 2000;

interface ParsedExpirationDate {
  expirationMonth: number;
  expirationYear: number;
}

@ValidatorConstraint({ name: 'IsFutureExpirationDate', async: false })
export class IsFutureExpirationDateConstraint implements ValidatorConstraintInterface {
  validate(rawValue: unknown): boolean {
    if (typeof rawValue !== 'string') {
      return false;
    }
    return isNotExpiredExpirationDate(rawValue);
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must be a valid MM/YY date that has not expired (e.g. "04/28")`;
  }
}

function isNotExpiredExpirationDate(rawExpirationDate: string): boolean {
  const parsedDate = parseExpirationDate(rawExpirationDate);
  if (parsedDate === null) {
    return false;
  }
  return isCurrentOrFutureMonth(parsedDate.expirationMonth, parsedDate.expirationYear);
}

function parseExpirationDate(rawExpirationDate: string): ParsedExpirationDate | null {
  const matchResult = MM_YY_PATTERN.exec(rawExpirationDate);
  if (matchResult === null) {
    return null;
  }
  const expirationMonth = Number.parseInt(matchResult[1], 10);
  if (!isValidCalendarMonth(expirationMonth)) {
    return null;
  }
  const expirationYear = TWO_DIGIT_YEAR_BASE + Number.parseInt(matchResult[2], 10);
  return { expirationMonth, expirationYear };
}

function isValidCalendarMonth(expirationMonth: number): boolean {
  return expirationMonth >= 1 && expirationMonth <= MONTHS_IN_YEAR;
}

function isCurrentOrFutureMonth(expirationMonth: number, expirationYear: number): boolean {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (expirationYear !== currentYear) {
    return expirationYear > currentYear;
  }
  return expirationMonth >= currentMonth;
}

export function IsFutureExpirationDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureExpirationDateConstraint,
    });
  };
}
```

### 3.4 Commit checkpoint

```powershell
git add src/transactions/dto/validators
git status
git commit -m "feat(transactions): add IsPositiveDecimalString and IsFutureExpirationDate validators"
```

---

## Step 4 — Request DTO

### 4.1 Create `src/transactions/dto/create-transaction.dto.ts` (exact content)

Every property: required, `class-validator` decorators per G5, `@ApiProperty` with `description` + realistic `example` (G6). Examples are future-dated relative to 2026-09 (`"04/28"`). The DTO is a data holder → public props are the documented exception to prefer-private-members.

```ts
/**
 * Request body of `POST /v1/transactions` (TODO-03 §1).
 *
 * The client sends raw transaction data; the API generates `id` (Numerator,
 * future TODO) and creates the receivable. Every field is required; unknown
 * properties are rejected by the global ValidationPipe
 * (`forbidNonWhitelisted: true` in `src/main.ts`). The card number is
 * accepted in full here — masking to last-4 happens at the service layer
 * (future TODO) via `maskCardNumber` (`src/common/utils/card-number.util.ts`).
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { IsFutureExpirationDate } from './validators/is-future-expiration-date.validator';
import { IsPositiveDecimalString } from './validators/is-positive-decimal-string.validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction amount as a decimal string, strictly positive, at most 2 decimal places.',
    example: '250.00',
  })
  @IsString()
  @IsPositiveDecimalString()
  value: string;

  @ApiProperty({
    description: 'Short human-readable description of the purchase.',
    example: 'T-Shirt Black M',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Payment method; decides the fee (2% debit, 4% credit) and the receivable status.',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    description: 'Full card number as received from the client (13–19 digits). Only the last 4 digits are ever stored or returned.',
    example: '5221456987541203',
  })
  @IsString()
  @Matches(/^\d{13,19}$/)
  cardNumber: string;

  @ApiProperty({
    description: 'Cardholder name as printed on the card.',
    example: 'Fonsi Julian',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cardHolderName: string;

  @ApiProperty({
    description: 'Card expiration date in MM/YY format. Must not have expired (valid through the end of the expiration month).',
    example: '04/28',
  })
  @IsString()
  @Matches(/^\d{2}\/\d{2}$/)
  @IsFutureExpirationDate()
  cardExpirationDate: string;

  @ApiProperty({
    description: 'Card verification code, 3 or 4 digits, kept as a string.',
    example: '290',
  })
  @IsString()
  @Matches(/^\d{3,4}$/)
  cardCvv: string;
}
```

### 4.2 Commit checkpoint

```powershell
git add src/transactions/dto/create-transaction.dto.ts
git status
git commit -m "feat(transactions): add CreateTransactionDto with validation and Swagger annotations"
```

---

## Step 5 — Response DTOs

Output-only classes: full `@ApiProperty`, ZERO `class-validator` decorators (TODO §2.3, G7). Public props = data-holder exception.

### 5.1 Create `src/transactions/dto/transaction-response.dto.ts` (exact content)

```ts
/**
 * Transaction resource as stored in json-server and returned by
 * `POST /v1/transactions` (TODO-03 §2.1). Output-only: no class-validator
 * decorators — validation applies to incoming data only.
 *
 * `cardNumber` is ALWAYS the masked form (last 4 digits); `cardCvv` is
 * returned as received (challenge sample keeps it — TODO §2.1 note).
 */
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Unique transaction id generated via the Numerator API (string per json-server convention).',
    example: '4',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction amount as received in the request.',
    example: '250.00',
  })
  value: string;

  @ApiProperty({
    description: 'Purchase description as received in the request.',
    example: 'T-Shirt Black M',
  })
  description: string;

  @ApiProperty({
    description: 'Payment method used for the transaction.',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD,
  })
  method: PaymentMethod;

  @ApiProperty({
    description: 'Masked card number: only the last 4 digits are stored or returned.',
    example: '1203',
  })
  cardNumber: string;

  @ApiProperty({
    description: 'Cardholder name as received in the request.',
    example: 'Fonsi Julian',
  })
  cardHolderName: string;

  @ApiProperty({
    description: 'Card expiration date in MM/YY format.',
    example: '04/28',
  })
  cardExpirationDate: string;

  @ApiProperty({
    description: 'Card verification code as received in the request.',
    example: '290',
  })
  cardCvv: string;
}
```

### 5.2 Create `src/transactions/dto/receivable-response.dto.ts` (exact content)

```ts
/**
 * Receivable resource as stored in json-server and returned by
 * `POST /v1/transactions` (TODO-03 §2.2). Output-only: no class-validator
 * decorators. Field names keep the json-server wire format
 * (`transaction_id`, `create_date`, snake_case).
 *
 * Fee rules (brief §3.2 USER DECISION): `discount` is the fee PERCENTAGE as
 * a string ("2" debit / "4" credit); `total = subtotal × (1 − discount/100)`.
 */
import { ApiProperty } from '@nestjs/swagger';
import { ReceivableStatus } from '../../common/enums/receivable-status.enum';

export class ReceivableResponseDto {
  @ApiProperty({
    description: 'Unique receivable id generated via the Numerator API (string per json-server convention).',
    example: '5',
  })
  id: string;

  @ApiProperty({
    description: 'Id of the transaction that originated this receivable.',
    example: '4',
  })
  transaction_id: string;

  @ApiProperty({
    description: 'paid for debit_card (settles D+0); waiting_funds for credit_card (settles 30 days later).',
    enum: ReceivableStatus,
    example: ReceivableStatus.WAITING_FUNDS,
  })
  status: ReceivableStatus;

  @ApiProperty({
    description: 'Receivable creation date. Documented as ISO-8601; note the json-server seed uses DD/MM/YYYY (known discrepancy — business TODO decides the final format).',
    example: '2026-09-13T12:00:00.000Z',
  })
  create_date: string;

  @ApiProperty({
    description: 'Subtotal: same value as the originating transaction.',
    example: '250.00',
  })
  subtotal: string;

  @ApiProperty({
    description: 'Fee percentage as a string: "2" (debit_card) or "4" (credit_card).',
    example: '4',
  })
  discount: string;

  @ApiProperty({
    description: 'Net amount: subtotal × (1 − discount/100), formatted as a string.',
    example: '240.00',
  })
  total: string;
}
```

### 5.3 Create `src/transactions/dto/create-transaction-response.dto.ts` (exact content)

```ts
/**
 * Envelope response of `POST /v1/transactions` (TODO-03 §2): both created
 * resources in one consistent body. Output-only: no class-validator
 * decorators.
 *
 * Gated by env `TRANSACTIONS_RETURN_BODY` (default `true`; see
 * `src/config/env.validation.ts` and `ConfigKeys.TransactionsReturnBody`):
 * when the flag is `false` the endpoint answers a bare `201 CREATED` and
 * this body is not produced. The runtime consumer (controller) arrives with
 * the TODO-04 orchestration work.
 */
import { ApiProperty } from '@nestjs/swagger';
import { ReceivableResponseDto } from './receivable-response.dto';
import { TransactionResponseDto } from './transaction-response.dto';

export class CreateTransactionResponseDto {
  @ApiProperty({
    description: 'The created transaction resource.',
    type: TransactionResponseDto,
  })
  transaction: TransactionResponseDto;

  @ApiProperty({
    description: 'The receivable created from the transaction.',
    type: ReceivableResponseDto,
  })
  receivable: ReceivableResponseDto;
}
```

### 5.4 Commit checkpoint

```powershell
git add src/transactions/dto/transaction-response.dto.ts src/transactions/dto/receivable-response.dto.ts src/transactions/dto/create-transaction-response.dto.ts
git status
git commit -m "feat(transactions): add transaction, receivable and envelope response DTOs"
```

---

## Step 6 — `TRANSACTIONS_RETURN_BODY` env plumbing (TODO §2.4, global plan §5/G9)

Pattern: mirror `SWAGGER_ENABLED` exactly (optional boolean + `transformBoolString` + initializer default `true`).

### 6.1 Edit `src/config/env.validation.ts`

1. Inside class `EnvironmentVariables`, AFTER the `CORS_ORIGINS` property, add:

```ts
  /** Optional; absent keeps the default `true` (TODO-03 §2.4: POST /v1/transactions returns the full { transaction, receivable } body; `false` ⇒ bare 201 CREATED). */
  @IsOptional()
  @Transform(({ value }) => transformBoolString(value))
  @IsBoolean()
  TRANSACTIONS_RETURN_BODY: boolean = true;
```

2. In the file-header JSDoc "Consumption map" bullet, append one sentence:
   `TRANSACTIONS_RETURN_BODY → transactions controller (TODO-04; plumbing only as of TODO-03 §2.4).`

Do NOT touch anything else in the file.

### 6.2 Edit `src/config/config.keys.ts`

1. In `ConfigKeys`, after `CorsOrigins: 'CORS_ORIGINS',`, add:

```ts
  TransactionsReturnBody: 'TRANSACTIONS_RETURN_BODY',
```

2. In the file-header JSDoc "Consumption map" paragraph, append:
   `TransactionsReturnBody → transactions controller (TODO-04; plumbing only as of TODO-03 §2.4).`

### 6.3 Edit `.env.example`

Append at the end of the file:

```text

# POST /v1/transactions response body switch (default true; false returns bare 201 CREATED)
TRANSACTIONS_RETURN_BODY=true
```

### 6.4 Edit local `.env` (GITIGNORED — NEVER stage it)

Open `.env` and append the same line as 6.3 (`TRANSACTIONS_RETURN_BODY=true`). This keeps local dev boot valid. Confirm with `git status` that `.env` does not appear.

### 6.5 Edit `docs/app-setup.md` (one table row only)

In the "Environment configuration" section table, add a row matching the existing table style:

| Variable | Purpose | Example |
|---|---|---|
| `TRANSACTIONS_RETURN_BODY` | Optional. When `false`, `POST /v1/transactions` answers a bare `201 CREATED` instead of the full `{ transaction, receivable }` body. Default `true`. | `true` |

No other prose changes in this step (broader docs belong to workflow step 4.4).

### 6.6 Commit checkpoint

```powershell
git add src/config/env.validation.ts src/config/config.keys.ts .env.example docs/app-setup.md
git status
```

Verify `.env` is NOT listed. Then:

```powershell
git commit -m "feat(config): add TRANSACTIONS_RETURN_BODY env toggle plumbing (default true)"
```

---

## Step 7 — Project structure map update + final verification

### 7.1 Edit `.agent/project-structure.md`

Replace the `src/common/` line and add the new entries so the two list sections read (keep every existing line not shown as changed):

```text
# Folders in src/

- src/ - NestJS application root: main.ts bootstrap and root AppModule
- src/common/ - Cross-cutting concerns: API-key constants, @Public() decorator, ApiKeyGuard, shared payment enums (enums/), fee constants (constants/), card masking util (utils/)
- src/config/ - Validated environment configuration: class-validator env schema (env.validation.ts) and ConfigService key constants (config.keys.ts)
- src/health/ - Public unversioned liveness probe: HealthModule + HealthController (HEAD /health/ping, TODO-02 §4)
- src/transactions/ - Transaction DTOs only so far (TODO-03): request CreateTransactionDto, response DTOs and custom validators in dto/; module/controller/service arrive in later TODOs
- test/ - e2e Jest config (jest-e2e.json); e2e specs arrive in later TODOs
```

(The `# Other folders` section stays unchanged.)

### 7.2 Full verification — ALL must exit 0

```powershell
npm run build
npm run lint
git status
```

- `npm run build` → exit 0, no TypeScript errors (proves DTOs/enums/validators compile and are importable — the TODO's only success criterion).
- `npm run lint` → exit 0 (the script auto-fixes trivial style issues; if a REAL lint error remains that the fix cannot resolve, fix it in place and amend nothing — make a follow-up commit).
- `git status` → only `.agent/todos/20260913/20260913-todo-4.md` remains untracked, working tree otherwise clean.

If build/lint fail: fix the reported file(s) minimally, re-run both, then commit.

### 7.3 Final commit checkpoint

```powershell
git add .agent/project-structure.md
git status
git commit -m "chore(structure): document transactions dto folder and common enums/constants/utils in structure map"
```

### 7.4 Sanity check (no commit)

```powershell
git log --oneline -10
```

Expect 8 commits from this plan (plans checkpoint, enums+constants, util, validators, request DTO, response DTOs, env plumbing, structure map) on top of the existing `feat/transaction-dtos` history. Do NOT push, do NOT merge — those belong to workflow steps later than this task.

---

## 8. Verification checklist — TODO requirement → plan step

| TODO requirement | Covered by |
|---|---|
| §1.1 endpoint contract (context only; no controller) | n/a — out of scope; DTO is the payload contract (Step 4) |
| §1.2 all 7 required request fields, no `id` from client | Step 4.1 (`CreateTransactionDto`, 7 fields, no `id`) |
| §1.3 `method` enum-restricted | Step 1.1 + Step 4.1 (`@IsEnum(PaymentMethod)`) |
| §1.3 `value` positive decimal string (rejects "0"/"0.00", negatives, garbage, >2 decimals) | Step 3.2 + Step 4.1 |
| §1.3 `cardExpirationDate` string, `MM/YY`, future-date (end-of-month, timezone-free) | Step 3.3 + Step 4.1 (`@Matches` + `@IsFutureExpirationDate`) |
| §1.3 `cardCvv` 3–4 digit numeric string | Step 4.1 (`@Matches(/^\d{3,4}$/)`) |
| §1.3 `cardNumber` digits + reasonable length | Step 4.1 (`@Matches(/^\d{13,19}$/)`) |
| §1.3 unknown properties rejected | Already global (`ValidationPipe` `forbidNonWhitelisted`); no per-DTO change |
| §1.4 `@ApiProperty` with description/example on every field; `enum` on `method` | Step 4.1 (all 7 properties) |
| §2.1 `TransactionResponseDto` (8 fields, masked cardNumber, cardCvv as received) | Step 5.1 |
| §2.2 `ReceivableResponseDto` (json-server naming, `status` enum, `discount` = percentage string) | Step 5.2 |
| §2.3 dedicated classes, output-only (no validators), full `@ApiProperty`, reuse both enums | Steps 5.1–5.3 |
| §2.3 envelope `{ transaction, receivable }` | Step 5.3 |
| §2.4 env toggle disabling default body return (plumbing only, per user-approved §5) | Step 6.1–6.5 + JSDoc pointer in Step 5.3 |
| §3 `PaymentMethod` / `ReceivableStatus` enums under `src/common/enums` | Step 1.1–1.2 |
| §3 fee percentage constants ("2"/"4" as strings) in app constants file | Step 1.3 |
| §4 request accepts full card number; response documents last-4-only; pure `maskCardNumber` helper provided | Steps 2.1, 4.1, 5.1 |
| §5 file locations (dto/ under `src/transactions`; enums under `src/common/enums`) | Steps 1, 3–5 |
| §6 out of scope respected | Scope section — nothing outside Steps 1–7 exists |
| §7 explicit validators over clever tricks; realistic Swagger examples (`config/db.json`, future-dated) | Steps 3–5 (examples `"250.00"`, `"T-Shirt Black M"`, `"04/28"`, `"290"`) |

**File-size check** (max-lines rule): largest new file is `create-transaction.dto.ts` ≈ 75 lines total (≈ 45 code lines) — well within budget; one class per file as mandated.

**Completion signal**: when Steps 0–7 are done and §7.2 passes with exit 0 on both commands, return the plan path `.kilo/plans/20260913-todo-3-transaction-dtos-impl.md` plus a summary of what was done and what was NOT done (no controller, no module, no tests, no push/merge).
