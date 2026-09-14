# Global Plan — Transaction Orchestration Logic (TODO-05 cycle)

- **TODO file**: `.agent/todos/20260913/20260913-todo-5.md` (internal title "TODO 04 – Transaction Orchestration Logic"; file number 5 is the workflow handle)
- **Branch**: `feat/transaction-orchestration` (created in step 2)
- **Version bump (step 3)**: `0.3.0` → `0.4.0` (minor — core business layer feature)
- **Front-end related**: NO → sub-steps 4.1a / 4.5a are **omitted**; the cycle runs 4.1b → 4.2 → 4.3 → 4.4 → 4.5b → 4.6
- **Auto-approve**: USER APPROVED 2026-09-14 "Approve Global and Tasks Plans" → global plan approved AND per-task plan (4.1b) auto-approved; proceed 4.1b → 4.6 without a second approval
- **Payment-date ruling (USER)**: Option B — `create_date` always = now; NO persisted `payment_date`; D+0/D+30 carried by `status`. See T5-G4

## Task parsing decision

Pattern-B-style `## Task N.` headings (precedent: TODO-04 global plan). Unlike TODO-04's three
independent deliverables, the five numbered sections here are inseparable facets of ONE unit of
work — a single `TransactionsService.create()` method and its module:

- Task 1: the service + module (the deliverable)
- Task 2: the required flow INSIDE that method
- Task 3: the fee rules applied by that flow
- Task 4: masking helper — **already implemented** (`src/common/utils/card-number.util.ts`, TODO-03); only the call-site lands here
- Task 5: error behavior of that method
- `## Module wiring`: part of Task 1's module

Decision: merged per the workflow's "extremely short/related tasks may be joined" clause →
**ONE consolidated 4.1–4.6 cycle** covering Tasks 1–5 + Module wiring. Step 4.6 appends `[DONE]`
to all five `## Task` headings. Running five full plan/review/docs/verification cycles on the
same two files would be redundant. (If the user prefers per-task cycles, reject at approval.)

## Global pre-analysis

### Hard constraints (from TODO + rules; binding)

- Strict flow order (TODO §Task 2, steps 1–9); both IDs reserved before ANY write.
- No controller, no route, no Swagger decorators, no guard usage, no compensation/saga, no unit/e2e tests (TODO §Out of scope). Errors propagate raw (Task 5).
- Reuse, do not re-declare: `maskCardNumber`, `PAYMENT_FEE_PERCENTAGES`, `PaymentMethod`, `ReceivableStatus`, `CreateTransactionDto`, response DTOs + envelope, `NumeratorService.getNextId()`, `JsonServerService.createTransaction/createReceivable`. Transport-only clients + their interfaces + the response DTOs stay **fully frozen** (Option-B ruling removed the only would-be additive field; see T5-G4/T5-G13).
- All money stays STRINGS on payloads and responses.
- No `process.env` — `ConfigService` + `ConfigKeys` only. Never log payloads (card data).
- Project rules: ≤200 lines/file (ideally ≤125 code-excl), ≤50-line methods (private helpers OK), ≤2 params per function (typed param objects beyond 2), ≤2 nesting depth, private-by-default, no commented code, self-documenting names, single-section boolean conditions.
- Do not run docker commands; if live services are needed, ask the user. This cycle needs NO live services (no route exists): verification = build + lint + optional boot.
- `.env` is user-owned/gitignored: never edit or commit it.

### Global technical & architecture decisions

| # | Decision | Value / rule |
|---|----------|--------------|
| T5-G1 | Deliverable layout | `src/transactions/transactions.module.ts` + `transactions.service.ts` (public `async create(dto: CreateTransactionDto): Promise<CreateTransactionResponseDto>`); module imports `NumeratorModule` + `JsonServerModule`, provides + **exports** `TransactionsService`; `AppModule.imports` gains `TransactionsModule` |
| T5-G2 | Pure fee/date logic | New `src/transactions/fee-rules.ts` (the file `architecture.md` already planned): pure functions — `resolveReceivableStatus(method)` (debit→`paid`, credit→`waiting_funds`), `computeTotal(subtotal: string, discountPercent: string): string` (integer-cents math, see T5-G5), `formatDateDDMMYYYY(date: Date): string` (create_date). **No add-days helper / no D+30 computation** — dead code under the Option-B ruling (T5-G4). Fee percentages MUST come from `PAYMENT_FEE_PERCENTAGES` (never re-declared). 4.1b may relocate helpers to `src/common/utils/` only if a 200-line/file push forces it |
| T5-G3 | Card masking | Call existing `maskCardNumber(dto.cardNumber)` when building the transaction payload. No new helper file (TODO Task 4 already satisfied since TODO-03 — recorded deviation) |
| T5-G4 | Dates (USER-RESOLVED) | `create_date` = local "now" formatted `DD/MM/YYYY` (zero-padded, matches seed). **NO `payment_date` field is persisted** — D+0/D+30 payment timing is carried exclusively by `status` (`paid` / `waiting_funds`) per README, user ruling of 2026-09-14. Consequence: no D+30/add-days code anywhere (would be dead code). The TODO's "payment date … DD/MM/YYYY" line stands superseded by this decision, recorded for 4.5b |
| T5-G5 | Total math (deterministic, no float drift) | subtotal ≤ 2 decimals is DTO-validated → parse to integer cents (`Math.round(parseFloat(v) * 100)`, safe for challenge-magnitude values; assert `Number.isSafeInteger`); `totalCents = Math.floor(cents × (100 − percent) / 100)`; format as `whole.dec2` **always with exactly 2 decimals** → floor == truncate (values are positive). Works examples: `"250.00"`/4 → `"240.00"`; `"340.50"`/2 → `"333.69"`; `"10.01"`/4 → `"9.60"` (9.6096 truncated); `"0.01"`/2 → `"0.00"` (valid edge, must not throw). Seed's loose `"196"`/`"96"` are pre-existing sample data, not output format — output is always 2-decimals per "Use 2 decimals places" + adopted DTO example `"240.00"` |
| T5-G6 | `TRANSACTIONS_RETURN_BODY` consumption | Service reads `ConfigKeys.TransactionsReturnBody` (`get(key, true)`). When `true` (default): return `{ transaction, receivable }` envelope built from the echoed client results. When `false`: still persist everything identically but return `undefined` (public return type widens to `Promise<CreateTransactionResponseDto \| undefined>`) — this TODO mandates the behavior at step 9 and the service is the first runtime consumer; the future controller relaying `undefined` yields Nest's natural empty `201 CREATED`. Decision D-RETBODY below stands unless rejected |
| T5-G7 | Payload construction | Build `CreateTransactionPayload` / `CreateReceivablePayload` (existing transport interfaces) verbatim: txn = reserved id + all request fields with masked card; receivable = reserved id + `transaction_id` + status/`create_date`/`subtotal`(=dto.value)/`discount`(percent string)/`total`. Returned DTO bodies = echo from `JsonServerService` (typed; json-server 201 not asserted — client behavior, T2-D3) |
| T5-G8 | Error behaviour | Zero try/catch in the service: `getNextId()` or `createTransaction`/`createReceivable` rejections propagate untouched (TODO Task 5). Partial-write (txn ok, receivable fail) is ACCEPTED at this stage — compensation is next-TODO scope; documented in service JSDoc |
| T5-G9 | Method shape | Public `create` stays a readable orchestrator (≤50-line body) delegating to private `buildTransactionPayload(...)`, `buildReceivablePayload(...)` etc.; every private helper ≤2 params (param objects when needed); boolean conditions single-section (extract named predicates) |
| T5-G10 | Logging | One `Logger` in the service; success-free by default (morgan covers HTTP later). May log numeric ids only; NEVER card/PII data |
| T5-G11 | Verification gate | `npm run build` + `npm run lint` exit 0; no tests (TODO exclusion); no HTTP smoke possible (no route). Optional boot smoke (port 3001) only if free — app still does zero outbound HTTP |
| T5-G12 | Structure map + docs | `.agent/project-structure.md` `src/transactions/` line updated (module+service exist; controller still pending). Docs (4.4): `docs/app-setup.md` orchestration section (first true consumer of both clients, fee rules table, date rules, `TRANSACTIONS_RETURN_BODY` now live), JSDoc headers on new files per house style, `architecture.md` dated entry + Request-Data-Flow steps 3–6 partial-implementation status, `context.md` closure |
| T5-G13 | Client-interface touch policy | **Zero changes** to `src/numerator/` or `src/json-server/` files and to the existing response DTOs for field-shape reasons: the Option-B ruling (T5-G4) removed the only candidate field. Any 4.2/4.3 edit to those frozen files is a scope deviation to reject |

## Resolved decision — payment date persistence (USER RULING 2026-09-14)

**Option B adopted**: the receivable persists ONLY `create_date` (= local now, `DD/MM/YYYY`);
there is NO `payment_date` field. The D+0 (debit) vs D+30 (credit) settlement timing is expressed
purely through `status` = `paid` / `waiting_funds`, exactly as the challenge README rules table
and `config/db.json` seed specify. The TODO §Task 3 "payment date … also in string format
DD/MM/YYYY" sentence is documentation-only and is **superseded** by this ruling; the 4.5b
adherence check must treat the absence of a `payment_date` field as compliant-by-user-decision,
not a gap. Consequence: `fee-rules.ts` computes no future dates (no add-days code — would be dead).

## Execution sequence (each 4.x = one isolated `task` invocation)

```text
Step 2: Git Feature Branch Setup (commit any pending edits per gitignore rule; merge/switch protocol; create feat/transaction-orchestration; .env stays untracked) => implementer
Step 3: Version Update 0.3.0 → 0.4.0 ('chore: bump version to 0.4.0') => implementer

Consolidated Task (service + flow + fees + masking + errors + wiring):
  4.1b Analysis & Planning => architector            → plan: .kilo/plans/20260914-transaction-orchestration-impl.md
       [user approval of task plan unless global approved WITH task auto-approve]
  4.2  Implementation => implementer                 (T5-G11 gate, meaningful commits)
  4.3  Code Review & Simplification => code-reviewer ∥ code-simplifier
       fixes applied => implementer (max 3 cycles)
  4.4  Documentation => docs-specialist
  4.5b Overall Plan Adherence => architector
  4.6  Task Completion ([DONE] on §Task 1–5 headings in todo-5.md, final commit) => implementer

Step 5: TODO File Completion (rename todo-5.md → -DONE; tmp cleanup; merge → main; push origin ONLY) => implementer
Step 6: Resume + next-TODO handoff text => planner
```

## Per-task pre-analysis

- Scope files: `transactions.module.ts`, `transactions.service.ts`, `fee-rules.ts` (new);
  `app.module.ts` (one import + one entry); `.agent/project-structure.md`
  one-line comment refresh (4.6/4.4 timeframe). NO edits to `src/numerator/`, `src/json-server/`,
  existing DTOs/enums/constants (Option-B ruling keeps all those frozen — see T5-G13).
- DTO/`@ApiProperty` annotations of existing files stay untouched (Swagger decorators are next-TODO scope).
- Envelope return bodies: prefer echoing persisted resources (client-resolved) so the response
  matches storage; masked card is already inside the payload, so the echo is inherently safe.
- Front-end: NO. Tests: NONE (TODO explicit exclusion — review cycle must not "add missing tests").
- Risks: (1) 4.3 reviewer proposing scope-expanding fixes (controller/tests) → reject, TODO governs;
  (2) date/timezone determinism in review → accepted local-calendar semantics per T5-G4;
  (3) `| undefined` return typing → standard, `strictNullChecks` already on.

## Approvals log

- 2026-09-14: global plan presented to user (pending response)
