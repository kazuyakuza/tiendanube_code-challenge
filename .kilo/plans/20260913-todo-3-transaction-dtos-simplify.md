# Simplification Plan — TODO 03 (cycle TD), Step 4.3 code-simplifier

- **Branch**: `feat/transaction-dtos` (diff reviewed: `d5abceb..HEAD`)
- **Baseline preserved**: binding decisions G1–G11 in `20260913-todo-3-transaction-dtos.md`
- **Scope respected**: only TODO-03 files (src/common/{enums,constants,utils}, src/transactions/dto + validators, env.validation.ts / config.keys.ts additions, .env.example, docs/app-setup.md, project-structure.md). main.ts, app.module.ts, health, guards untouched.
- **Verification run**: `npm run build` → exit 0; `npm run lint` → exit 0 (pre-existing state, before any proposed change).

## SIMPLIFICATION PLAN: NONE

The implementation is already minimal and plan-conformant. No code changes are proposed
for sub-step 4.3-fix. Itemized audit (all checks passed, nothing to change):

1. **Dead/redundant code** — none. Every file in the TODO-03 set is reachable and pinned
   by G1–G4 (`PAYMENT_FEE_PERCENTAGES` is intentionally unconsumed until TODO-04 business
   logic — G3 explicitly defines it as "for later business logic"; not dead code).
   No commented-out code anywhere in the diff.
2. **Duplicated literals vs constants** — DTO descriptions mentioning "2% debit, 4% credit"
   (create-transaction.dto.ts:36) and `"2"/"4"` (receivable-response.dto.ts:46) are
   Swagger *prose*, not computable magic numbers; importing `PAYMENT_FEE_PERCENTAGES`
   into a description string would reduce literal clarity for zero dedup gain. Left as-is.
3. **Duplicated MM/YY regex** (`@Matches(/^\d{2}\/\d{2}$/)` in create-transaction.dto.ts:65
   vs `MM_YY_PATTERN` in is-future-expiration-date.validator.ts:18) — inspected for
   unification per mandate; **unification is NOT safe**: removing `@Matches` would change
   error semantics (one combined "has not expired" error instead of two distinct errors
   "must match MM/YY" + "has not expired", i.e. different message keys surfaced to the
   client), and G5 explicitly pins "two separate simple decorators". Left as-is.
4. **Validator complexity** — both validators respect all structural rules: max depth 2,
   ≤2 params per function, single-section boolean conditions (`isCurrentOrFutureMonth`
   uses early-return, not compound conditions), explicit UTC-only date math
   (`getUTCFullYear`/`getUTCMonth` — no locale/TZ pitfall), no clever code. The
   month/year comparison is deliberately explicit rather than a `year*12+month` trick —
   correct per TODO §7 "prefer explicit, readable".
5. **@ApiProperty verbosity** — every description+example retained as required; no
   abstraction proposed (file set is tiny; literal clarity preferred per mandate item 3).
6. **Rule compliance of 4.2 output** — all new source files ≤86 lines (<125 ideal);
   longest method body ≈ 10 lines; max 2 params everywhere (incl. the
   `ParsedExpirationDate` object avoiding a 3rd param in `isCurrentOrFutureMonth`);
   no unnecessary type assertions (the single `propertyName as string` is the
   class-validator API requirement); edge cases handled (non-string input guard,
   impossible months 00/13, end-of-month semantics documented).
7. **env plumbing (G9)** — `TRANSACTIONS_RETURN_BODY` exactly mirrors the established
   `SWAGGER_ENABLED` pattern (`@IsOptional` + `transformBoolString` reuse + typed
   default + `ConfigKeys` entry). Zero duplication introduced; `transformBoolString`
   is correctly *reused*, not copied.

## DEFER (notes for planner — no action in 4.3-fix)

- **D1 — `registerDecorator` wrapper boilerplate**: `IsFutureExpirationDate()` and
  `IsPositiveDecimalString()` each repeat the same 9-line `registerDecorator` wrapper.
  A shared helper (e.g. `createCustomValidatorDecorator(constraint)`) could dedupe it,
  but for a 2-validator TODO-03 this is abstraction without measurable benefit and
  slightly conflicts with "avoid clever code". Revisit ONLY if a 3rd+ custom validator
  appears (likely TODO-04+). Extensive? No — but plan-pinned structure (G5 names the
  two validator files) → planner decision, not executed here.
- **D2 — Swagger description echoes between request and response DTOs** (e.g.
  "T-Shirt Black M", "04/28", "290" examples repeated in
  transaction-response.dto.ts). A shared examples-const module could serve it, but the
  mandate says prefer literal clarity at this scale → deferred until the response
  surface grows (TODO-04 envelope wiring).

## Expected outcome

No changes → no build/lint re-run required; current verified state (build exit 0,
lint exit 0) stands. Sub-step 4.3-fix can be skipped as "nothing to apply".
