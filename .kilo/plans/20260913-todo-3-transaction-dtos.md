# Global Plan — TODO 03: Transaction DTOs & Request Validation

- **Source TODO**: `.agent/todos/20260913/20260913-todo-3.md` (internally titled "TODO 02"; file name `todo-3` is authoritative for workflow bookkeeping)
- **Workflow**: `.kilo/commands/critical-workflow.md` — Planner orchestration, steps 1→6
- **Date**: 2026-09-13
- **Front-end related**: **No** — every cycle omits sub-steps 4.1a and 4.5a

---

## 1. TODO parsing (step 1)

File uses `# Title` + `## Section` headings (Pattern B, restricted to the self-named
"Task N" sections). Executable sections: **Task 1** (request DTO), **Task 2** (response
DTOs, incl. §2.4 env config), **Task 3** (shared enums/constants), **Task 4**
(card-masking helper + design decision). Non-task sections: Goal, Context, Task 5
(file locations), Task 6 (out of scope), Task 7 (guidance) — these are constraints.

**Consolidation decision (workflow-permitted for extremely short/related tasks)**:
Tasks 1–4 are one inseparable compilation unit — the request DTO imports the enums,
the envelope response DTO imports both response DTOs, and the masking helper is a
single pure function. They are executed as **ONE cycle "TD"** (one full 4.1b→4.6
sequence). All other `## Task N` readings would produce four empty cycles over 6–8
small files. If the user prefers per-task cycles, this plan must be amended before
step 4 begins.

## 2. Global pre-analysis

### 2.1 Repository state (verified 2026-09-13)

- On `main`, up to date with `origin/main`; merge commit `d5abceb` closed TODO-02.
- NestJS 11 app exists: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`), URI versioning `defaultVersion: '1'`, Swagger at `/docs` with the
  `API-Key` scheme, global `ApiKeyGuard`, `HEAD /health/ping` public, validated env
  config (`src/config/env.validation.ts` + `ConfigKeys`).
- `class-validator` 0.14, `class-transformer` 0.5, `@nestjs/swagger` 11 are installed —
  **no new dependencies are allowed in this TODO**.
- Jest is configured (`passWithNoTests: true`; no spec files exist). Task 6 of the
  TODO declares tests out of scope → verification is **build + lint only**.
- Pending working-tree edits already on `main` (user-made): `package.json` (3 docker
  scripts + jest array formatting) and `src/health/health.controller.ts` (curl comment
  port `3001`→`30001`; `{} ` brace spacing). Step 2 commits them as a checkpoint.
  The `30001` value looks like a typo (dev port is `3001`, no app service in
  docker-compose.yml) but is user content → committed as-is, flagged, not reverted.
- Untracked: `20260913-todo-3.md` (this task — committed in step 2) and
  `20260913-todo-4.md` (**user-owned, never staged** by this workflow).

### 2.2 Global technical & architecture decisions (bind all sub-plans)

| # | Decision |
|---|----------|
| G1 | New folder `src/transactions/dto/` for all four DTO classes; **no** `TransactionsModule` / controller / service is created (Task 6 out of scope; files only need to compile and be importable). |
| G2 | Shared enums go to **`src/common/enums/`** (`payment-method.enum.ts`, `receivable-status.enum.ts`). This supersedes the `src/transactions/enums/` sketch in TODO §5, because TODO §5's own closing line mandates `src/common/enums` and both enums are cross-cutting (transaction + receivable). |
| G3 | Fee percentage constants (`debit_card → "2"`, `credit_card → "4"`, stored as string) live in **`src/common/constants/payment-fee.constants.ts`** (TODO §3 "maybe in a app constants file"). Constants, not magic numbers in DTOs. |
| G4 | `maskCardNumber(full: string): string` — pure, exported helper in **`src/common/utils/card-number.util.ts`**; returns the last 4 characters; no validation inside (request DTO owns validation); unit-test later (out of scope now). |
| G5 | `CreateTransactionDto` field rules (all fields required, unknown props already rejected by the global pipe — no per-DTO option needed):<br>• `value: string` — `@IsString`, `@Matches(/^\d+(\.\d{1,2})?$/)` (digits, optional ≤2-decimal part; regex rejects negatives) **and** must be strictly positive: `"0"`, `"0.00"` invalid. Implementation choice fixed by plan: one small dedicated custom validator `IsPositiveDecimalString` in `src/transactions/dto/validators/is-positive-decimal-string.validator.ts` — no chained `@ValidateIf` tricks (TODO §7 "explicit, readable").<br>• `description: string` — `@IsString`, `@IsNotEmpty`, `@MaxLength(200)`.<br>• `method: PaymentMethod` — `@IsEnum(PaymentMethod)`.<br>• `cardNumber: string` — `@IsString`, `@Matches(/^\d{13,19}$/)` (digits + reasonable PCI length; full PCI rules explicitly out of scope).<br>• `cardHolderName: string` — `@IsString`, `@IsNotEmpty`, `@MaxLength(100)`.<br>• `cardExpirationDate: string` — `@Matches(/^\d{2}\/\d{2}$/)` **and** must be a valid future date (interpretation `MM/YY`, end-of-month semantics: `04/28` valid through 30 Apr 2028). Fixed implementation choice: dedicated custom validator `IsFutureExpirationDate` in `src/transactions/dto/validators/is-future-expiration-date.validator.ts` (parses MM/YY, compares `month/year >= current month/year`). Two separate simple decorators (`@Matches` + `@Validate`) instead of one clever regex.<br>• `cardCvv: string` — `@Matches(/^\d{3,4}$/)`. |
| G6 | Every request-DTO property carries `@ApiProperty` with `description` + realistic `example` (from `config/db.json` / README style), `enum: PaymentMethod` on `method`. **Examples must use future dates only** (e.g. `"04/28"`, `"09/29"`): today is 2026-09 — a sample like `"06/26"` would fail the request's own validator.<br>`cardNumber` request example = a plausible 16-digit full number. |
| G7 | Response DTOs (`TransactionResponseDto`, `ReceivableResponseDto`, `CreateTransactionResponseDto` = `{ transaction, receivable }`): plain classes with full `@ApiProperty` (type/format/description/example), **zero** `class-validator` decorators (output only — TODO §2.3). `cardNumber` documented as last-4-digits only; `cardCvv` documented as "as received". Receivable fields keep json-server wire naming: `id`, `transaction_id`, `status` (`ReceivableStatus` enum), `create_date`, `subtotal`, `discount` (fee **percentage** string per the recorded USER DECISION + brief §3.2), `total`. |
| G8 | `create_date` format: documented as **ISO-8601** string (`@ApiProperty({ example: '2026-09-13T12:00:00.000Z' })`); it remains a plain `string` so TODO-04 business logic may override. The seed data's `DD/MM/YYYY` discrepancy is noted in the property description. |
| G9 | §2.4 env toggle — **USER APPROVED 2026-09-13**: optional boolean env `TRANSACTIONS_RETURN_BODY` (default `true`), plumbing only in this TODO (see §5). |
| G10 | Style constraints (`.kilo/rules/`): files ≤200 lines; public props only for data-holder DTO/enums classes (documented exception, same precedent as `EnvironmentVariables`); no commented-out code; self-documenting names; single-section boolean conditions inside validators; JSDoc header per file with TODO-03 + AI-agent guidance (docs step 4.4 owns this). |
| G11 | `.agent/project-structure.md` gains `src/common/enums/`, `src/common/constants/`, `src/common/utils/`, `src/transactions/` entries (update during 4.2/4.4). |

### 2.3 Explicit non-goals (TODO §6, enforced on every sub-agent)

No controller (not even a stub), no module wiring, no Numerator/json-server calls, no
fee arithmetic, no ID generation, no persistence, no unit/e2e tests, no new npm
dependencies, no `main.ts`/`app.module.ts` edits **besides** none (env flag G9 touches
only `env.validation.ts`, `config.keys.ts`, `.env.example`).

## 3. Per-task pre-analysis (cycle TD)

- **Deliverables**: 2 enum files · 1 constants file · 1 util file · 2 validator files ·
  4 DTO files · env-flag files (§5) · `docs/app-setup.md` + `.agent/project-structure.md`
  updates. Roughly 12–14 new small files, all declarative.
- **Primary risk**: over-engineering (custom validators creep into business logic).
  Mitigation: plan 4.1b must be literal/snippet-complete for a junior implementer.
- **Verification reality**: DTOs are invisible to Swagger until a controller exists
  (TODO-04). Success = `npm run build` + `npm run lint` exit 0, every class fully
  `@ApiProperty`-decorated, enums/constants importable from `src/common/`.

## 4. Execution sequence (steps → sub-agents)

```text
Step 2  Git Feature Branch Setup                      => implementer
        - checkpoint-commit pending main edits (package.json, health.controller.ts)
        - commit .agent/todos/20260913/20260913-todo-3.md (NOT todo-4.md)
        - already on main → create + switch `feat/transaction-dtos`
Step 3  Version Update 0.1.0 → 0.2.0 (minor, feature) => implementer
TD 4.1b Analysis & Implementation Plan                => architector
        - path: .kilo/plans/20260913-todo-3-transaction-dtos-impl.md
TD 4.2  Implementation (follows 4.1b plan literally)  => implementer
TD 4.3  Code Review & Simplification (concurrent)     => code-reviewer + code-simplifier
        - fix plans (if any) => implementer sub-task; max 3 cycles
TD 4.4  Documentation                                 => docs-specialist
TD 4.5b Overall Plan Adherence                        => architector
TD 4.6  [DONE] marks on TODO §§1–4 + commit           => implementer
Step 5  TODO completion: rename todo-3 → -DONE,
        merge feat/transaction-dtos → main, delete branch,
        push main → origin ONLY, update context.md     => implementer
```

Approval matrix (per this global plan): **APPROVED 2026-09-13 — user chose
"Approve Global and Tasks Plans"**: the consolidated single cycle stands (no split
requested) and the per-task 4.1b plan is auto-approved (presented, not gated).

## 5. TODO §2.4 — RESOLVED (user answered 2026-09-13: option "TRANSACTIONS_RETURN_BODY flag, plumbing only")

Interpretation adopted: optional boolean env var **`TRANSACTIONS_RETURN_BODY`**,
default `true`, pattern-mirroring `SWAGGER_ENABLED` (`@IsOptional` + boolean
`@Transform` reusing `transformBoolString` + typed default + `ConfigKeys.
TransactionsReturnBody`). Default `true` = future `POST /v1/transactions` returns the
full `{ transaction, receivable }` body; `false` = bare `201 CREATED`. This TODO ships
ONLY the plumbing: `env.validation.ts` field, `ConfigKeys` entry, `.env.example` entry,
local `.env` note (gitignored — implementer updates it so dev boot stays valid), docs
table in `docs/app-setup.md`, and a property-level JSDoc pointer on
`CreateTransactionResponseDto` recording the toggle contract. The runtime consumer
arrives with the TODO-04 controller. No other reading of §2.4 is permitted downstream.

## 6. Git & remote safety

- All work on `feat/transaction-dtos`; merge to `main` in step 5; push **only** to
  `origin` (`.kilo/rules/git-remote-safety.md`).
- Every sub-agent follows `.kilo/rules/gitignore-compliance.md`: `.env`,
  `node_modules/`, `coverage/`, `dist/` never staged; `todo-4.md` never staged.
- Branch create/switch restricted to step 2; version bump restricted to step 3;
  push restricted to step 5.
