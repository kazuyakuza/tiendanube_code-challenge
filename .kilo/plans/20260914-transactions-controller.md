# Cycle A Implementation Plan — Transactions Controller & Module Wiring (TODO-06 §Task 1 + §Task 3)

- Plan: `.kilo/plans/20260914-transactions-controller.md` (cycle A of global plan
  `.kilo/plans/20260914-transactions-endpoint.md` — binding)
- TODO: `.agent/todos/20260913/20260913-todo-6.md` — §Task 1 (1.1 endpoint,
  1.2 configurable response behaviour, 1.3 Swagger) + §Task 3 (module & wiring)
  ONLY. **§Task 2 (error handling & compensation) is Cycle B — OUT OF SCOPE.**
  A thin controller that calls the service is all Cycle A needs; raw service
  errors propagate until Cycle B adds the global exception filter.
- Implementer: JUNIOR developer under 50% restriction — execute steps in order,
  no scope expansion, no architectural decisions. If anything is ambiguous,
  STOP and report to the caller.
- Branch/version/git-push are RESTRICTED to other workflow steps: branch
  `feat/transactions-endpoint` and version `0.5.0` ALREADY exist (steps 2–3
  done). This plan contains NO branch creation, NO version bump, NO push.

## 1. Pre-analysis findings (verified against the installed code, not memory)

| # | Finding | Evidence |
|---|---|---|
| F1 | Installed `@nestjs/swagger` is **11.4.7** (`package.json` declares `^11.2.1`; `node_modules/@nestjs/swagger/package.json` → `11.4.7`). All legacy decorators the TODO names are **exported and NOT deprecated** in this version: `ApiOperation`, `ApiBody`, `ApiCreatedResponse`, `ApiUnauthorizedResponse`, `ApiBadRequestResponse`, `ApiServiceUnavailableResponse` — plus `ApiBadGatewayResponse` and `ApiInternalServerErrorResponse` (verified in `node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.js` exports and `api-operation.decorator.d.ts`; **zero `@deprecated` markers** in any `dist/decorators/*.d.ts`). | node_modules inspection (this cycle) |
| F2 | **G2/R4 verified**: `@HttpCode(201)` + a handler that returns `undefined` produces **201 with an empty body**. `node_modules/@nestjs/platform-express/adapters/express-adapter.js` `reply()` (lines 44–50) sets `response.status(statusCode)` FIRST, then `if (isNil(body)) return response.send()`. In-repo precedent: `HealthController.ping(): void` + `@HttpCode(HttpStatus.OK)` has answered 200 + empty body since T4. → NO deviation needed; the thin controller contract works as designed. | node_modules inspection + T4 precedent |
| F3 | All four DTOs are **fully `@ApiProperty`-annotated** for Swagger rendering: `CreateTransactionDto` (7/7 fields), `TransactionResponseDto` (8/8), `ReceivableResponseDto` (7/7), `CreateTransactionResponseDto` (2/2 with nested `type` refs). → ZERO DTO edits (G7 frozen surfaces hold). | DTO files read (this cycle) |
| F4 | The document-level security requirement (`addSecurityRequirements(API_KEY_SECURITY_SCHEME)` in `main.ts` `setupSwagger`, T5) applies to **every operation** in the generated OpenAPI document — the transactions operation inherits the `x-api-key` requirement and the Authorize button sends the header on Try-it-out. → NO operation-level `@ApiSecurity` is needed (G6 conditional resolved: not needed). | `main.ts` lines 90–100 |
| F5 | `AppModule` already imports `TransactionsModule` and registers the global `APP_GUARD` (`app.module.ts`). **No code change needed in `app.module.ts`.** Its header JSDoc ("no route/controller exists yet… zero outbound HTTP") becomes stale after this cycle — that truth sweep belongs to the 4.4 docs step, NOT to this implementation step. | `app.module.ts` read |
| F6 | Version is already `0.5.0` and branch `feat/transactions-endpoint` already exists (workflow steps 2–3 executed before this cycle). | `package.json` line 3 |
| F7 | `npm test` exits 0 with zero spec files: jest config carries `"passWithNoTests": true` (`package.json` line 68). Tests remain TODO-07 scope. | `package.json` |

## 2. High-level approach

1. Create ONE new file: `src/transactions/transactions.controller.ts` — a thin
   controller (G3) with a single `@Post()` handler that binds
   `CreateTransactionDto` → `TransactionsService.create(dto)` and returns the
   service result directly (G2). Guard protection comes from the global
   `APP_GUARD` — NO `@UseGuards`, NO `@Public()` (G1). Full Swagger per G6
   using the legacy decorator set (F1: present + non-deprecated in 11.4.7).
2. Edit ONE existing file: `src/transactions/transactions.module.ts` — add
   `controllers: [TransactionsController]` and refresh the header JSDoc
   (it currently says "NO controller exists yet").
3. Verify: `npm run build` exit 0 → `npm run lint` exit 0 (twice: fix +
   recheck) → `npm test` exit 0 → temp DI/boot sanity script (`tmp-di-sanity.js`,
   T3-D3 precedent: boots the real AppModule, no port binding, no outbound
   HTTP, deleted after run, never committed).
4. Commit ONCE (CA-D4) with both files staged.
5. Everything else — service, DTOs, `app.module.ts`, `main.ts`, `src/numerator/`,
   `src/json-server/`, env files, config keys — is FROZEN (G7): zero diffs.
   JSDoc truth sweeps of stale headers belong to step 4.4 (docs-specialist).

## 3. Decisions table (all structural choices pre-made — no judgment left)

| # | Decision | Rationale |
|---|---|---|
| CA-D1 | `@Controller('transactions')` — **no** explicit `version` metadata. | The global `defaultVersion: '1'` (`main.ts` URI versioning) mounts it at `/v1/transactions`; matches global plan §4 wording. `HealthController` keeps its explicit `VERSION_NEUTRAL` as the documented contrast. |
| CA-D2 | Swagger decorator form = the **legacy set exactly as TODO §1.3 names it** (`@ApiOperation`, `@ApiBody`, `@ApiCreatedResponse`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`, `@ApiServiceUnavailableResponse`) **plus** `@ApiBadGatewayResponse` + `@ApiInternalServerErrorResponse` (G6's 502/500 additions — Cycle B's filter will produce those statuses; TODO's "(or equivalent)" covers the superset). | F1: all verified exported and non-deprecated in installed 11.4.7. No modern-form deviation needed. |
| CA-D3 | NO `@ApiSecurity` on the operation. | F4: the document-level security requirement already covers every operation; adding it would be redundant. |
| CA-D4 | Exactly ONE code commit containing both files. | `transactions.module.ts` references the controller class — a separate controller-only commit would leave an intermediate broken build. |
| CA-D5 | Boot check via temp `tmp-di-sanity.js` (repo root), following the T3-D3 precedent: `NestFactory.create(AppModule, { logger: false })` + `app.close()` — no port binding, no outbound HTTP, no docker. `create()` instantiates the whole module graph including the controller, so DI/wiring errors surface here. | G9: no live-curl by agents; build alone cannot catch DI graph errors. Script deleted after run, never committed. |
| CA-D6 | NO JSDoc truth-sweep of frozen files in this step (`transactions.service.ts`, `app.module.ts`, DTO headers still say "no controller yet"). | G7 + precedent (TODO-05 4.4 did the frozen-file JSDoc sweep). The 4.4 docs-specialist step owns it. |
| CA-D7 | Handler signature: `async create(@Body() createTransactionDto: CreateTransactionDto): Promise<CreateTransactionResponseDto | undefined>` — mirrors the service return type exactly. | G2: single gate at service level; no controller-level re-read of `TRANSACTIONS_RETURN_BODY`. |
| CA-D8 | `@HttpCode(HttpStatus.CREATED)` is kept even though POST defaults to 201. | TODO §Implementation guidance: "Prefer explicit HTTP status decorators so the contract is obvious"; it is also the mechanism that feeds `statusCode` into `reply()` for the nil-body path (F2). |

## 4. Detailed steps

### Step 0 — Preconditions check

1. Run `git status --short`. Expected: no staged entries; at most untracked
   plan/TODO artifacts. If the tree holds unrelated staged changes → STOP,
   report to caller.
2. Run `git branch --show-current`. Expected EXACTLY: `feat/transactions-endpoint`.
   If different → STOP, report to caller (branch ops are restricted to step 2).
3. Run `git log --oneline -3`. Expect the version bump commit `chore: bump version to 0.5.0` in recent history (F6).

### Step 1 — Create `src/transactions/transactions.controller.ts`

Create the file with EXACTLY this content (≈90 lines; ≤200-line rule satisfied,
≤125 effective):

```ts
/**
 * HTTP controller for `POST /v1/transactions` (TODO-06 §Task 1.1–1.3;
 * global plan G1–G3/G6, cycle A).
 *
 * Thin orchestration endpoint (G3): validate → call → return. The body is
 * validated by the global ValidationPipe (`whitelist`/`forbidNonWhitelisted`/
 * `transform` in `src/main.ts`) against `CreateTransactionDto`; invalid
 * payloads answer **400**. The handler returns `TransactionsService.create(dto)`
 * directly — the `TRANSACTIONS_RETURN_BODY` gate lives at the SERVICE level
 * (global plan G2): `true` ⇒ `CreateTransactionResponseDto` envelope, `false`
 * ⇒ `undefined`, which the Express adapter serializes as a bare **201** with
 * an empty body (`@HttpCode(201)` sets the status before the nil-body send —
 * verified in `express-adapter.js reply()`).
 *
 * Security (G1): API-key protection is enforced by the GLOBAL `ApiKeyGuard`
 * registered via `APP_GUARD` in `app.module.ts`. This controller deliberately
 * carries NO `@UseGuards` and NO `@Public()` — every request must send the
 * matching `x-api-key` header (missing/wrong ⇒ **401**). Do not add either
 * decorator; a redundant second enforcement is a plan violation.
 *
 * Error behaviour: domain errors (`NumeratorUnavailableError`,
 * `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError`,
 * `JsonServerRequestError`) propagate RAW from the service — the documented
 * 502/503 responses are produced once the Cycle-B global exception filter
 * (global plan G4) lands; until then they surface as the NestJS default 500.
 * The Swagger annotations below already document the target contract.
 *
 * Versioning (CA-D1): no `version` metadata — the global `defaultVersion: '1'`
 * (`main.ts` URI versioning) mounts this at `/v1/transactions`. Contrast:
 * `HealthController` opts OUT with `VERSION_NEUTRAL`.
 *
 * Related: `docs/app-setup.md`; global plan
 * `.kilo/plans/20260914-transactions-endpoint.md` (§3 G1–G3, G6).
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionResponseDto } from './dto/create-transaction-response.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Creates one transaction plus its corresponding receivable (TODO-06 §1.1).
   * Returns the `{ transaction, receivable }` envelope, or a bare `201` with
   * an empty body when `TRANSACTIONS_RETURN_BODY=false` (service-level gate,
   * G2). Requires the `x-api-key` header (global `ApiKeyGuard`, G1).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a transaction and its corresponding receivable' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({
    description: 'Transaction and receivable created; body omitted when TRANSACTIONS_RETURN_BODY=false.',
    type: CreateTransactionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Payload failed DTO validation.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid x-api-key header.' })
  @ApiServiceUnavailableResponse({ description: 'Numerator or json-server unreachable (mapping lands with the Cycle-B exception filter).' })
  @ApiBadGatewayResponse({ description: 'json-server returned an unexpected 4xx (mapping lands with the Cycle-B exception filter).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error (mapping lands with the Cycle-B exception filter).' })
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<CreateTransactionResponseDto | undefined> {
    return this.transactionsService.create(createTransactionDto);
  }
}
```

Self-checks after writing:
- File is ≤ 200 lines; method body is 1 line; nesting depth 1; 1 constructor
  param (≤2-params rule); member is `private readonly`; no commented-out code.
- `@Controller('transactions')` — NO `version` key, NO `@Public()`, NO
  `@UseGuards` anywhere in the file.

### Step 2 — Edit `src/transactions/transactions.module.ts`

Apply TWO edits to the existing file (read it first; preserve everything else):

Edit 1 — replace the ENTIRE header JSDoc block (current lines 1–15) with:

```ts
/**
 * Feature module for the transaction orchestration (TODO-06 §Task 3,
 * global plan cycle A).
 *
 * Registers `TransactionsController` — the `POST /v1/transactions` route,
 * versioned to `/v1` by the global `defaultVersion: '1'` — and provides
 * `TransactionsService` to it. Imports the two external-client modules so
 * the service can inject `NumeratorService` (two reserved ids per create)
 * and `JsonServerService` (both writes). The global `ConfigModule`
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. The service stays EXPORTED for future consumers (tests, Cycle-B
 * compensation wiring).
 *
 * Security note (G1): no `@UseGuards` here — the global `ApiKeyGuard`
 * (`APP_GUARD` in `app.module.ts`) already protects the controller's
 * non-`@Public` routes with 401 on missing/wrong `x-api-key`.
 *
 * Related: `docs/app-setup.md`; `transactions.controller.ts`.
 */
```

Edit 2 — inside `@Module({...})`, add the controllers array and the import.
The decorator body becomes EXACTLY:

```ts
import { TransactionsController } from './transactions.controller';

@Module({
  controllers: [TransactionsController],
  imports: [NumeratorModule, JsonServerModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
```

(Place the new import with the other relative imports, after
`./transactions.service` per the file's existing ordering.)

Self-checks:
- The file keeps its imports of `JsonServerModule`, `NumeratorModule`,
  `TransactionsService` — nothing removed.
- `git diff -- src/transactions/transactions.module.ts` shows ONLY the header
  JSDoc replacement + 1 import line + 1 `controllers:` line.

### Step 3 — Verification gates (G9)

Run each command alone (single-cmd discipline):

1. `npm run build` → expect exit 0, `dist/` regenerated.
2. `npm run lint` (auto-fixes) → then re-run `npm run lint` → expect exit 0
   with no remaining fixes.
3. `npm test` → expect exit 0; "No tests found" output is the expected green
   state (F7, `passWithNoTests: true`).
4. Inspect `git status --short` → `dist/` must NOT appear (gitignored; if it
   appears, STOP and report).

### Step 4 — Temp DI/boot sanity script (CA-D5, T3-D3 precedent)

Because `@nestjs/testing` is absent, create a temporary root-level script
INSIDE the working directory named exactly `tmp-di-sanity.js`:

```js
// TEMPORARY verification artifact — delete after run, never commit.
const { NestFactory } = require('@nestjs/core');

async function run() {
  const { AppModule } = require('./dist/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  console.log('DI-SANITY-OK');
  await app.close();
}

run().catch((error) => {
  console.error('DI-SANITY-FAIL:', error);
  process.exitCode = 1;
});
```

- Mechanics: `npm run build` already produced `dist/` with real DI metadata;
  the script boots the REAL AppModule (which instantiates
  `TransactionsController` and its injected `TransactionsService`) with
  `logger: false`; `app.close()` replaces any `listen` — no port binding, no
  HTTP egress, no docker, no live services. Config keys resolve from the repo
  `.env` loaded by ConfigModule at create-time.
- Run: `node tmp-di-sanity.js`
- Expected: exactly one line `DI-SANITY-OK`, exit code 0.
- On failure (`DI-SANITY-FAIL:` or a throw): STOP implementation, report the
  error to the caller, do NOT commit. Do not improvise fixes beyond Steps 1–2.

### Step 5 — Cleanup, commit, final assertions

1. Delete `tmp-di-sanity.js` (plain file removal; never commit it).
2. Read `.gitignore` and run `git status --short`. Expected EXACTLY:
   - `?? src/transactions/transactions.controller.ts`
   - ` M src/transactions/transactions.module.ts`
   Nothing else — no `dist/`, no `tmp-*`, nothing staged. If the DTO/service/
   app.module files appear as modified → scope violation, revert them.
3. Run `git diff --name-only` → confirm ONLY `src/transactions/transactions.module.ts`
   is modified; `src/transactions/transactions.service.ts`, `src/app.module.ts`,
   `src/main.ts`, everything under `src/numerator/` and `src/json-server/` and
   `src/transactions/dto/` must be ABSENT (G7 frozen surfaces; CA-D6).
4. Stage EXACTLY the two files and commit ONCE:

   ```text
   git add src/transactions/transactions.controller.ts src/transactions/transactions.module.ts
   git commit -m "feat(transactions): add POST /v1/transactions controller with Swagger docs and module wiring"
   ```

5. Run `git status --short` → expect clean tree (no staged, no modified).
   NO push (restricted to step 5 of the workflow).

## 5. Verification table (TODO bullet → satisfying step)

| TODO bullet | Satisfying step / evidence |
|---|---|
| §1.1 `POST /v1/transactions` versioned under `/v1` | Step 1: `@Controller('transactions')` + `@Post()`; global `defaultVersion: '1'` mounts `/v1` (CA-D1) |
| §1.1 protected by API Key guard | G1: global `APP_GUARD` `ApiKeyGuard`; controller has NO `@Public()`/`@UseGuards` (Step 1 JSDoc + self-check) |
| §1.1 request body `CreateTransactionDto` | Step 1: `@Body() createTransactionDto: CreateTransactionDto` + `@ApiBody({ type: CreateTransactionDto })` |
| §1.1 success `201 Created` | Step 1: `@HttpCode(HttpStatus.CREATED)` (CA-D8) |
| §1.2 `TRANSACTIONS_RETURN_BODY=true` → 201 + envelope | Step 1: handler returns service result; service returns `CreateTransactionResponseDto` (G2) |
| §1.2 `TRANSACTIONS_RETURN_BODY=false` → 201 + empty body | Step 1: service returns `undefined`; F2 verified in `express-adapter.js reply()` + `HealthController.ping()` precedent (CA-D7) |
| §1.3 `@ApiOperation` | Step 1 decorator (F1 verified non-deprecated) |
| §1.3 `@ApiBody` linked to `CreateTransactionDto` | Step 1 decorator |
| §1.3 `@ApiCreatedResponse` linked to `CreateTransactionResponseDto` | Step 1 decorator (`type: CreateTransactionResponseDto`) |
| §1.3 `@ApiUnauthorizedResponse` / `@ApiBadRequestResponse` / `@ApiServiceUnavailableResponse` | Step 1 decorators (legacy set, CA-D2) |
| §1.3 security requirement for `x-api-key` | F4: document-level requirement inherited by the operation; NO `@ApiSecurity` (CA-D3) |
| §Task 3 register `TransactionsController` in `TransactionsModule` | Step 2: `controllers: [TransactionsController]` |
| §Task 3 API Key guard "on the controller or route" | G1: satisfied by the global `APP_GUARD`; no redundant decorator (noted in module JSDoc) |
| §Task 3 `TransactionsModule` imported by `AppModule` | F5: pre-existing import verified — no change needed |
| §Implementation guidance "thin controller" | Step 1: 1-line method body, no business logic, no try/catch (G3) |

## 6. Out-of-scope guards (violations = STOP and report)

- NO changes to: `src/transactions/transactions.service.ts` (its try/catch
  change is Cycle B per G5), `src/transactions/dto/**`, `src/numerator/**`,
  `src/json-server/**`, `src/app.module.ts`, `src/main.ts`, `src/config/**`,
  `src/common/**`, `.env*`, `package.json`.
- NO unit/e2e tests (TODO §Out of scope — TODO-07 owns them).
- NO error mapping, no try/catch, no exception filter in the controller
  (Cycle B, G4).
- NO JSDoc truth-sweep of stale frozen-file headers (4.4 docs step, CA-D6).
- NO branch creation/switch, NO version bump, NO push (restricted steps).

## 7. Rule-compliance quick-check (before commit)

- `transactions.controller.ts` ≈ 90 lines total, ≤ 125 effective (max-lines rule).
- `create()` body = 1 line (max-50-lines rule); nesting depth 1 (max-depth rule).
- Constructor: 1 param; handler: 1 param (max-2-params rule).
- `transactionsService` member is `private readonly` (prefer-private rule).
- Self-documenting names; no comments explaining the obvious; no commented-out
  code (no-commented-code rule).
- Explicit named imports; no magic numbers introduced.

## 8. §User-manual-test (hand to the user at step 6 — NOT run by agents)

Requires `docker compose up` (json-server :8080, Numerator :3000) and
`npm run start:dev` (PORT 3001). Transcribed from TODO §Implementation guidance:

```bash
curl -X HEAD http://localhost:3001/health/ping

curl -X POST http://localhost:3001/v1/transactions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key-here" \
  -d '{
    "value": "100.00",
    "description": "T-Shirt Black M",
    "method": "credit_card",
    "cardNumber": "4111111111111111",
    "cardHolderName": "Jane Doe",
    "cardExpirationDate": "12/28",
    "cardCvv": "123"
  }'
```

Expected after this cycle:

1. Health probe still answers `200` (regression check).
2. The POST answers **201** with the envelope:
   `{ "transaction": { "id": "4", ..., "cardNumber": "1111", ... },
      "receivable": { "id": "5", "transaction_id": "4", "status": "waiting_funds",
      "subtotal": "100.00", "discount": "4", "total": "96.00", ... } }`
   (credit_card ⇒ 4% fee, `waiting_funds`; ids continue from the seed "3";
   card masked to last 4). A new transaction + receivable appear in json-server.
3. Same POST without the `x-api-key` header → **401** (global guard now
   observable on a real route).
4. Same POST with a malformed payload (e.g. `"value": "-5"`) → **400** (global
   ValidationPipe).
5. Swagger UI at `http://localhost:3001/docs/` lists the new operation with
   request/response schemas and error responses; after Authorize with the API
   key, "Try it out" succeeds.
6. With `TRANSACTIONS_RETURN_BODY=false` in `.env` (restart), the same POST
   answers **201 with an empty body**.

## 9. Acceptance checklist

| Acceptance | Evidence |
|---|---|
| `POST /v1/transactions` reachable, versioned `/v1` | Controller + CA-D1; DI sanity boots; user manual test §8 |
| Guard applied without redundancy | No `@UseGuards`/`@Public()` in controller or module; `APP_GUARD` global (G1) |
| 201 envelope / bare 201 per env flag | G2 service-level gate + F2 adapter verification; user manual test §8 items 2/6 |
| Swagger complete | Legacy decorator set (F1) + `@ApiBadGatewayResponse`/`@ApiInternalServerErrorResponse` (G6); `/docs` check §8 item 5 |
| Module wired | `controllers: [TransactionsController]` in `TransactionsModule`; `AppModule` import pre-existing (F5) |
| Frozen surfaces untouched | `git diff --name-only` shows ONLY the two files (Step 5.3) |
| Gates green | build + lint (×2) + test exit 0; `DI-SANITY-OK` (Steps 3–4) |
| Exactly one code commit | Step 5.4; no branch/version/push actions |
