# Implementation Plan — Transaction Orchestration (TODO-05 consolidated cycle)

[Project Info: Active]

- **TODO**: `.agent/todos/20260913/20260913-todo-5.md` (internal title "TODO 04 – Transaction Orchestration Logic"; five `## Task` sections + Module wiring run as ONE merged cycle per user ruling).
- **Global plan (BINDING; decisions T5-G1…T5-G13)**: `.kilo/plans/20260914-transaction-orchestration.md` — this plan encodes them, never re-opens them.
- **Branch**: `feat/transaction-orchestration` — ALREADY created. Do NOT create/switch branches, do NOT bump versions, do NOT push, do NOT run docker commands.
- **USER RULING — payment date (Option B)**: `create_date` = now formatted `DD/MM/YYYY`, always. There is **NO `payment_date` field anywhere** (payload, DTO, helpers, docs of this cycle). D+0 (debit) vs D+30 (credit) settlement timing is carried ONLY by `status` (`paid` / `waiting_funds`). The TODO §Task 3 sentence "payment date of D+30 … DD/MM/YYYY" is SUPERSEDED documentation — 4.5b must treat its non-implementation as compliant-by-user-decision.

---

## 1. High-level approach

Implement ONE new NestJS feature module `TransactionsModule` under `src/transactions/` that
orchestrates the existing, injectable clients (`NumeratorService` TODO-04 Task 1, `JsonServerService`
TODO-04 Task 2) into a single public method `create(dto)`. The method strictly follows the 9-step
flow of TODO §Task 2: reserve two IDs first, mask the card, compute fee data, build both payloads
with the existing transport interfaces, persist transaction then receivable, and — gated by
`ConfigKeys.TransactionsReturnBody` (`get(key, true)` per T5-G6) — return the echoed
`{ transaction, receivable }` envelope or `undefined`. Pure logic (status mapping, cents math with
truncation, DD/MM/YYYY formatting) lives in a new pure module `src/transactions/fee-rules.ts`
(T5-G2). Zero try/catch (T5-G8); errors propagate raw. The only existing file modified is
`src/app.module.ts` (one import + one `imports` entry + header JSDoc refresh). Numerator,
json-server, DTOs, enums, constants, guards, config are FROZEN (T5-G13). No controller, no tests,
no docker. Gate: `npm run build` + `npm run lint` both exit 0 (T5-G11).

---

## 2. File inventory

### 2.1 NEW files

| File | Purpose |
|---|---|
| `src/transactions/fee-rules.ts` | Pure helpers: `resolveReceivableStatus`, `computeTotal`, `formatDateDDMMYYYY` (T5-G2). **No add-days / D+30 code — dead under Option B.** No shared `date-format.util.ts` is created. |
| `src/transactions/transactions.service.ts` | The orchestrator. Public `create`, private helpers ≤2 params. |
| `src/transactions/transactions.module.ts` | Imports `NumeratorModule` + `JsonServerModule`; provides + **exports** `TransactionsService`; NO controller. |

### 2.2 MODIFIED files

| File | Change |
|---|---|
| `src/app.module.ts` | Add `TransactionsModule` import statement + one `imports:` entry; update header JSDoc minimally (the "NO business route/controller" sentence must STAY TRUE — still no route exists). |

### 2.3 FORBIDDEN files (frozen per T5-G13) — any edit is a scope deviation to reject

- Everything under `src/numerator/` and `src/json-server/` (services, modules, constants, errors, interfaces).
- Existing DTOs under `src/transactions/dto/` (including all their `@ApiProperty` JSDoc/examples).
- `src/common/**` (enums, `payment-fee.constants.ts`, `card-number.util.ts`, guards, decorators).
- `src/config/**` (`config.keys.ts`, `env.validation.ts`).
- `src/main.ts`, `src/health/**`, `.env`, `.env.example` (`TRANSACTIONS_RETURN_BODY` already exists).
- `.agent/project-structure.md` is NOT touched in 4.2 either: its `src/transactions/` line is refreshed in 4.4 (docs step) per T5-G12 — NOT by the implementer of this plan.

---

## 3. New file specifications

### 3.1 `src/transactions/fee-rules.ts` (pure functions, no Nest imports)

House-style JSDoc header (pattern: module purpose + "AI-agent guidance" bullet list, as in
`payment-fee.constants.ts`). Content skeleton:

```ts
/**
 * Pure fee/date business rules for the transaction orchestration
 * (TODO §Task 3, global plan T5-G2). No NestJS imports — plain functions
 * designed for later unit testing.
 *
 * Payment-method rules (brief §3.2):
 * - debit_card  → fee "2", receivable status `paid`  (settles D+0)
 * - credit_card → fee "4", receivable status `waiting_funds` (settles D+30)
 *
 * The fee PERCENTAGES themselves are NOT declared here — the service looks
 * them up in PAYMENT_FEE_PERCENTAGES
 * (`src/common/constants/payment-fee.constants.ts`) and passes the percent
 * string into `computeTotal`; never re-declare "2"/"4" in this file.
 *
 * USER RULING (Option B, 2026-09-14): there is NO payment_date field and NO
 * future-date computation anywhere — D+0/D+30 timing is expressed ONLY via
 * `status`. Do not add add-days code here (it would be dead code).
 */
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { ReceivableStatus } from '../common/enums/receivable-status.enum';

/** 2-decimal wire format: always exactly two fractional digits. */
const DECIMAL_SCALE = 100;
const DECIMAL_PLACES = 2;

export function resolveReceivableStatus(method: PaymentMethod): ReceivableStatus {
  return method === PaymentMethod.DEBIT_CARD
    ? ReceivableStatus.PAID
    : ReceivableStatus.WAITING_FUNDS;
}

export function computeTotal(subtotal: string, discountPercent: string): string {
  const subtotalCents = parseCents(subtotal);
  const totalCents = Math.floor((subtotalCents * (DECIMAL_SCALE - Number(discountPercent))) / DECIMAL_SCALE);
  return formatCents(totalCents);
}

export function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(DECIMAL_PLACES, '0');
  const month = String(date.getMonth() + 1).padStart(DECIMAL_PLACES, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function parseCents(value: string): number {
  const cents = Math.round(parseFloat(value) * DECIMAL_SCALE);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`subtotal cents value is not a safe integer: ${value}`);
  }
  return cents;
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const whole = Math.floor(absCents / DECIMAL_SCALE);
  const fraction = absCents % DECIMAL_SCALE;
  return `${sign}${whole}.${String(fraction).padStart(DECIMAL_PLACES, '0')}`;
}
```

**MUST-PASS worked examples (T5-G5)** — verify by mental trace before committing (no tests exist):

| `subtotal` | `discountPercent` | Expected `total` | Why |
|---|---|---|---|
| `"250.00"` | `"4"` | `"240.00"` | 25000 × 96 / 100 = 24000 |
| `"340.50"` | `"2"` | `"333.69"` | 34050 × 98 / 100 = 33369 |
| `"10.01"` | `"4"` | `"9.60"` | 1001 × 96 / 100 = 9609.6 → floor 9609 → `"9.60"` (truncation, not rounding) |
| `"0.01"` | `"2"` | `"0.00"` | 1 × 98 / 100 = 0.98 → floor 0 → valid edge, must NOT throw |

Rationale (one line): denominator is exactly 100 and inputs are ≤2 decimals, so integer-cents math
with `Math.floor` reproduces "drop the remaining decimals" without float drift.

Notes:
- Date helper uses LOCAL calendar fields (`getDate`/`getMonth`/`getFullYear`), zero-padded day and
  month only (year already 4 digits) — matches seed `config/db.json` DD/MM/YYYY style per T5-G4.
- `resolveReceivableStatus` uses a single-section ternary on one boolean expression — complies with
  the single-section-boolean rule.
- `subtotal`/`discountPercent` are 2 params (< 3) — no param-object needed here.

### 3.2 `src/transactions/transactions.service.ts`

Full skeleton class + imports (copy verbatim); the private helper bodies live in §3.3 and go where
the `// ... private helpers below` marker sits. Line-budget: ~120 lines total, every method body
≤ 50 lines, max nesting depth 2, single-section conditions.

```ts
/**
 * Transaction orchestration service (TODO §Task 1/2; global plan T5-G1).
 *
 * Single public method `create(dto)` turns a valid `CreateTransactionDto`
 * into a persisted transaction + receivable pair, in the strict 9-step flow
 * of TODO §Task 2 (both Numerator ids reserved BEFORE any write).
 *
 * Error behaviour (TODO §Task 5, T5-G8): NO try/catch — failures of
 * `getNextId()` or of either json-server write propagate untouched. A
 * transaction persisted but a receivable that fails leaves a PARTIALLY
 * WRITTEN state; this is accepted at this stage and compensation is next-
 * TODO scope (controller + global error handling). The caller must see the
 * raw failure.
 *
 * Logging (T5-G10): one debug line on success carrying ONLY the two numeric
 * string ids — never the payload (card data) and never amounts.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskCardNumber } from '../common/utils/card-number.util';
import { PAYMENT_FEE_PERCENTAGES } from '../common/constants/payment-fee.constants';
import { ConfigKeys } from '../config/config.keys';
import { NumeratorService } from '../numerator/numerator.service';
import { JsonServerService } from '../json-server/json-server.service';
import {
  CreateReceivablePayload,
} from '../json-server/interfaces/create-receivable-payload.interface';
import {
  CreateTransactionPayload,
} from '../json-server/interfaces/create-transaction-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionResponseDto } from './dto/create-transaction-response.dto';
import {
  formatDateDDMMYYYY,
  computeTotal,
  resolveReceivableStatus,
} from './fee-rules';

interface ReservedIds { transactionId: string; receivableId: string; }

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly numeratorService: NumeratorService,
    private readonly jsonServerService: JsonServerService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateTransactionDto): Promise<CreateTransactionResponseDto | undefined> {
    const ids = await this.reserveIds();
    const transactionResult = await this.jsonServerService.createTransaction(
      this.buildTransactionPayload({ dto, transactionId: ids.transactionId }),
    );
    const receivableResult = await this.jsonServerService.createReceivable(
      this.buildReceivablePayload({ dto, receivableId: ids.receivableId, transactionId: ids.transactionId }),
    );
    this.logger.debug(`transaction ${ids.transactionId} + receivable ${ids.receivableId} created`);
    if (!this.shouldReturnBody()) {
      return undefined;
    }
    const response = new CreateTransactionResponseDto();
    response.transaction = transactionResult;
    response.receivable = receivableResult;
    return response;
  }

  // ... private helpers below
}
```

**Return type widening note**: the TODO §Task 1 signature shows non-optional; the `| undefined`
widening is required by the Option-B flag behavior at step 9 (T5-G6). Record in §8 deviations.

### 3.3 Helper decomposition of the service (ALL private, ≤2 params each)

The payload builder for the receivable needs 3 values (dto, receivableId, transactionId) → a typed
param object is required. DECISION (per workflow, one option must be picked): the two small
interfaces `ReservedIds`, `BuildTransactionPayloadContext` and `BuildReceivablePayloadContext` stay
declared **in the same service file**; no new `src/transactions/interfaces/` folder is created
(rationale: all three objects are internal to this service's flow, never shared).

Helper list with exact signatures (copy verbatim):

```ts
private async reserveIds(): Promise<ReservedIds> {
  // step 1 then step 2 of the flow — TWO awaits in strict order:
  const transactionId = await this.numeratorService.getNextId();
  const receivableId = await this.numeratorService.getNextId();
  return { transactionId, receivableId };
}
```

```ts
private buildTransactionPayload(context: BuildTransactionPayloadContext): CreateTransactionPayload {
  // verbatim pass-through fields + masked card + reserved id
  return {
    id: context.transactionId,
    value: context.dto.value,
    description: context.dto.description,
    method: context.dto.method,
    cardNumber: maskCardNumber(context.dto.cardNumber),
    cardHolderName: context.dto.cardHolderName,
    cardExpirationDate: context.dto.cardExpirationDate,
    cardCvv: context.dto.cardCvv,
  };
}
```

```ts
private buildReceivablePayload(context: BuildReceivablePayloadContext): CreateReceivablePayload {
  const discount = PAYMENT_FEE_PERCENTAGES[context.dto.method];
  return {
    id: context.receivableId,
    transaction_id: context.transactionId,
    status: resolveReceivableStatus(context.dto.method),
    create_date: formatDateDDMMYYYY(new Date()),
    subtotal: context.dto.value,
    discount,
    total: computeTotal(context.dto.value, discount),
  };
}
```

```ts
private shouldReturnBody(): boolean {
  return this.configService.get<boolean>(ConfigKeys.TransactionsReturnBody, true);
}
```

Required type declarations (same file, just above `@Injectable()` or below imports):

```ts
interface BuildTransactionPayloadContext { dto: CreateTransactionDto; transactionId: string; }
interface BuildReceivablePayloadContext {
  dto: CreateTransactionDto;
  receivableId: string;
  transactionId: string;
}
```

Notes:
- Payload-building helpers are SYNCHRONOUS (pure mapping) — only `reserveIds` is async.
- `new Date()` is created inside `buildReceivablePayload` once, so both persistence and (implicitly)
  the response carry the same instant.
- `shouldReturnBody()` extracts a single-section predicate per the boolean rule; the step-9 gate is
  `if (!this.shouldReturnBody())` — remotely one condition, no magic coupling.
- Order inside `create`: persist transaction (step 7) THEN receivable (step 8), strictly.

### 3.4 `src/transactions/transactions.module.ts`

```ts
/**
 * Feature module for the transaction orchestration (TODO §Module wiring,
 * global plan T5-G1).
 *
 * Imports the two external-client modules so `TransactionsService` can
 * inject `NumeratorService` (two reserved ids per create) and
 * `JsonServerService` (both writes). The global `ConfigModule`
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. `TransactionsService` is EXPORTED so the future controller module
 * (next TODO) can consume it; NO controller exists yet — no route points at
 * this module.
 */
import { Module } from '@nestjs/common';
import { JsonServerModule } from '../json-server/json-server.module';
import { NumeratorModule } from '../numerator/numerator.module';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [NumeratorModule, JsonServerModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
```

Rationale (one line): exact mirror of the client-module style (`json-server.module.ts`) so DI and
review conventions stay uniform.

### 3.5 `src/app.module.ts` modification (exact diff)

1. Add the import line BELOW the existing `JsonServerModule` import (current import order is
   Health → Numerator → JsonServer; `./transactions/...` sorts last):
   ```ts
   import { TransactionsModule } from './transactions/transactions.module';
   ```
2. Add `TransactionsModule,` as the LAST entry of `imports` (after `JsonServerModule,`).
3. Header JSDoc: insert ONE sentence into the "External clients" paragraph, changed minimally to:
   - Keep the sentence that says "There is still NO business route/controller" — it becomes:
     "The orchestration service (`TransactionsModule`, TODO-05) orchestrates both clients but NO
     route/controller exists yet, so the clients still perform zero outbound HTTP calls until the
     controller TODO wires an endpoint."
   Rationale: keeps the header truthful (service exists, route does not) with a 2-line edit.

---

## 4. Payload & response mapping tables (T5-G7; single source of truth)

### 4.1 `CreateTransactionDto` → `CreateTransactionPayload`

| Payload field | Source |
|---|---|
| `id` | `transactionId` (FIRST `getNextId()` call) |
| `value` | `dto.value` verbatim (string, never converted) |
| `description` | `dto.description` verbatim |
| `method` | `dto.method` verbatim (enum value `debit_card`/`credit_card`) |
| `cardNumber` | `maskCardNumber(dto.cardNumber)` |
| `cardHolderName` | `dto.cardHolderName` verbatim |
| `cardExpirationDate` | `dto.cardExpirationDate` verbatim |
| `cardCvv` | `dto.cardCvv` verbatim |

### 4.2 fee output → `CreateReceivablePayload`

| Payload field | Source |
|---|---|
| `id` | `receivableId` (SECOND `getNextId()` call) |
| `transaction_id` | `transactionId` (same first id) |
| `subtotal` | `dto.value` verbatim |
| `discount` | `PAYMENT_FEE_PERCENTAGES[dto.method]` (lookup, never re-declared) |
| `status` | `resolveReceivableStatus(dto.method)` |
| `total` | `computeTotal(dto.value, discount)` |
| `create_date` | `formatDateDDMMYYYY(new Date())` — no `payment_date` field AT ALL |

### 4.3 Response envelope (`CreateTransactionResponseDto`, step 9)

`response.transaction` = the value returned by `jsonServerService.createTransaction` (the echoed
persisted body, TYPE-typed as `TransactionResponseDto`); `response.receivable` idem from
`createReceivable`. **Echo the client results** (T5-G7 pre-analysis: "prefer echoing persisted
resources so the response matches storage"). Rationale (one line): values are already re-shaped by
the transport layer; re-mapping from locals would duplicate the payload tables and risk divergence.
Assemble via `new CreateTransactionResponseDto()` — the class has no constructor arguments; assign
its two public fields (`transaction`, `receivable`, already public on the DTO) since object-literal
assignment to a class instance is not possible.

---

## 5. Error behaviour (T5-G8)

- ZERO `try`/`catch` anywhere in this cycle's new code. No error classes are created. No
  compensation/cleanup logic.
- `reserveIds` failure (either of the two `getNextId()` calls) → propagates; NOTHING is written
  (both IDs reserved before any write; if reservation of the SECOND id fails, no write happened).
- `createTransaction` failure → propagates; nothing persisted.
- `createReceivable` failure after a successful transaction write → propagates and leaves a
  partially written state — ACCEPTED at this stage (TODO §Task 5); compensation is next-TODO scope.
  This MUST be documented in the service file JSDoc (§3.2 header already encodes the wording).
- Service never swallows, wraps, re-throws, or logs error details.

## 6. Logging (T5-G10, decided)

- One `private readonly logger = new Logger(TransactionsService.name);` field.
- The ONLY line, emitted right after the receivable write resolves (before the gate):
  `this.logger.debug(\`transaction ${ids.transactionId} + receivable ${ids.receivableId} created\`);`
- On the success path it carries ONLY the two numeric-string ids. NO payloads, card data, amounts,
  or dates. No failure logging (clients own theirs; exceptions propagate raw).

---

## 7. Step-by-step execution (tiny steps; each ends in a commit or a check)

Pre-condition: working tree clean (`git status` shows nothing pending); if dirty, STOP and report
to the caller (checkpointing belongs to step 2 of the workflow, already done).

**Step 1 — fee-rules.ts** → create `src/transactions/fee-rules.ts` exactly per §3.1 (module
JSDoc header + imports + three exported functions + two private helpers with the given verbatim
bodies). No Nest imports. Commit:
`feat(transactions): add pure fee rules module (status map, cents math, DD/MM/YYYY date)`
Rationale (one line): pure layer first so the service compiles against final signatures immediately.

**Step 2 — transactions.service.ts** → create per §3.2 + §3.3. Include the two context interfaces.
`import { CreateReceivablePayload }` / `import { CreateTransactionPayload }` may be merged into
single lines each per house preference — either is lint-clean; pick one import per line as shown.
Do NOT run build yet (module not registered — compiles fine, but hold commit until step 4 so the
wiring commit is atomic; see Step 4). NO commit yet.

**Step 3 — transactions.module.ts** → create per §3.4. NO commit yet.

**Step 4 — app.module.ts wiring** → apply the §3.5 diff (import + imports entry + 2-line header
JSDoc touch). Then run, in order:
- `npm run build` — MUST exit 0.
- `npm run lint` — MUST exit 0 (fix only lint OF THE NEW FILES if flagged; anything else → stop
  and report).
On success, ONE commit covering steps 2–4:
`feat(transactions): orchestrate transaction + receivable creation in TransactionsService`
Rationale (one line): the module register + service trio only works when registered together;
atomic commit keeps the repo buildable at every commit.

**Step 5 — verification gate (T5-G11)** → re-run both commands and record exit codes in the
completion summary:
- `npm run build` → exit 0 REQUIRED.
- `npm run lint` → exit 0 REQUIRED.
- NO tests (jest runs `passWithNoTests`; TODO §Out of scope). Do NOT run `npm run test`, no e2e,
  no docker, no HTTP smoke (no route exists).
- OPTIONAL boot smoke ONLY if port 3001 is free: `npm run start:dev`, confirm boot log, Ctrl+C.
  Never commit temp scripts. If the port is taken, skip — build+lint is the gate.

**Step 6 — final check** → `git status` MUST show a clean tree (all changes committed):
expected files: 3 new (`fee-rules.ts`, `transactions.service.ts`, `transactions.module.ts`) +
1 modified (`app.module.ts`). Zero edits inside any forbidden path (§2.3). Report the summary with:
what was done / what was NOT done (no controller, no tests, no docs — 4.4 owns docs incl. the
`.agent/project-structure.md` line refresh and the frozen-file JSDoc "consumer" sweeps).

### Commit sequence summary

| # | Commit message | Files |
|---|---|---|
| 1 | `feat(transactions): add pure fee rules module (status map, cents math, DD/MM/YYYY date)` | `src/transactions/fee-rules.ts` |
| 2 | `feat(transactions): orchestrate transaction + receivable creation in TransactionsService` | service + module + `app.module.ts` |
| 3 | (4.6, later) `docs(transactions): [DONE] marks + structure-map refresh` | todo file / docs (NOT this plan) |

Final expectation: `git status` clean.

---

## 8. Deviations table for the 4.5b adherence check

| # | TODO text | Implementation | Status |
|---|---|---|---|
| D1 | §Task 3 "payment date … D+30 … DD/MM/YYYY" | NOT implemented — Option B user ruling: D+0/D+30 carried only by `status`; NO `payment_date` anywhere; no add-days code | compliant-by-user-decision |
| D2 | §Task 4 "Implement a small pure helper in a shared util" | Helper already exists (`src/common/utils/card-number.util.ts`, TODO-03); this cycle only adds the call-site | compliant — Task 4 satisfied since TODO-03 |
| D3 | §Task 1 signature `Promise<CreateTransactionResponseDto>` | Widened to `Promise<CreateTransactionResponseDto \| undefined>` for step 9 flag-off behavior | compliant-by-decision (T5-G6) |
| D4 | §Task 2 step 3 wording "keep only last 4 digits" | `maskCardNumber` returns last 4 CHARACTERS (contract-identical for the 13–19 digit input) | equivalent |
| D5 | §Task 2 step 9 "returns 201 CREATED" | The HTTP status is controller territory (out of scope); the service returns `undefined`, controller TODO yields bare `201` | postponed by scope |
| D6 | DTO JSDoc "future TODO" pointers (e.g. `create-transaction.dto.ts` header, `config.keys.ts` consumption map) | NOT edited (frozen paths, T5-G13); 4.4 docs sweep owns truth-refresh | delegated to 4.4 |

## 9. Original-TODO traceability (section-by-section)

| TODO section | Where in this plan |
|---|---|
| Task 1 service + module + `create` | §3.2, §3.4 |
| Task 2 flow (steps 1–9) | §3.2 `create` body + §3.3 `reserveIds` (1–2), `buildTransactionPayload` (3+5), `buildReceivablePayload` (4+6), the two persist calls (7–8), the gate + return (9) |
| Task 3 fee rules + concrete calcs + dates | §3.1, §4.2 |
| Task 4 masking (satisfied TODO-03) | §4.1 cardNumber row, deviation D2 |
| Task 5 error behaviour | §5 |
| Module wiring (imports Numerator+JsonServer, exports service, no controller) | §3.4 |
| Out of scope (controller/route, guard usage, Swagger, saga, tests) | §2.3 + §7 Step 5 prohibitions |
