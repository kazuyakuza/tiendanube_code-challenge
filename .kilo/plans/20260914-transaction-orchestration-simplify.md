# Simplification Plan — Transaction Orchestration (4.3 code-simplifier)

- **Scope**: commits `207f79c` + `759bb62` on `feat/transaction-orchestration` — `src/transactions/fee-rules.ts`, `src/transactions/transactions.service.ts`, `src/transactions/transactions.module.ts`, `src/app.module.ts` diff only.
- **Binding context**: TODO `.agent/todos/20260913/20260913-todo-5.md`; global plan `.kilo/plans/20260914-transaction-orchestration.md` (T5-G1…T5-G13); impl plan `.kilo/plans/20260914-transaction-orchestration-impl.md` (§8 deviations D1–D6 approved).
- **Frozen paths** (no edit): `src/common/**`, `src/config/**`, `src/numerator/`, `src/json-server/`, `src/transactions/dto/**`, `package.json`, `.env*`.
- **Result of evaluation**: exactly ONE worthwhile simplification (Step 1). All other candidates REJECTED (log in §3). Nothing here reopens any T5-G decision or Option-B ruling.

---

## 1. Step 1 — Name the net-percent factor in `computeTotal`

**File**: `src/transactions/fee-rules.ts` (lines 32–36).

**Why**: the current line is the only 3-level nested-paren expression in the new code and reads `DECIMAL_SCALE` twice in two different roles (percent base 100 vs cents divisor 100). Hoisting the percent-remaining factor into a named local removes the nesting, matches the TODO formula `subtotal × (1 − discount/100)`, and satisfies the self-documenting-code rule. Zero behavior change: identical integer arithmetic (`subtotalCents * remainingPercent` computed with the same value, then floor-divided by `DECIMAL_SCALE`).

**Rule rationale**: self-documenting code (`.kilo/rules/self-documenting-code.md`); max-depth spirit (flattens one paren-nesting level); no behavior change (code-guidelines #5 — preserve behavior).

**Exact change** — replace:

```ts
export function computeTotal(subtotal: string, discountPercent: string): string {
  const subtotalCents = parseCents(subtotal);
  const totalCents = Math.floor((subtotalCents * (DECIMAL_SCALE - Number(discountPercent))) / DECIMAL_SCALE);
  return formatCents(totalCents);
}
```

with:

```ts
export function computeTotal(subtotal: string, discountPercent: string): string {
  const subtotalCents = parseCents(subtotal);
  const remainingPercent = DECIMAL_SCALE - Number(discountPercent);
  const totalCents = Math.floor((subtotalCents * remainingPercent) / DECIMAL_SCALE);
  return formatCents(totalCents);
}
```

**Constraints for the implementer**:
- Change ONLY this function body. Do NOT touch `formatCents` (sign branch stays — defensive, see §3), `parseCents`, `resolveReceivableStatus`, `formatDateDDMMYYYY`, the module JSDoc, or any other file.
- No new exports, no signature change (still 2 params).
- Verify against the impl-plan §3.1 worked examples mentally (unchanged): `"250.00"`/`"4"` → `"240.00"`; `"340.50"`/`"2"` → `"333.69"`; `"10.01"`/`"4"` → `"9.60"`; `"0.01"`/`"2"` → `"0.00"`.

**Verification gate**: `npm run build` exit 0 AND `npm run lint` exit 0 (T5-G11). No tests exist; do not add any (TODO §Out of scope).

**Commit message**: `refactor(transactions): name the net-percent factor in computeTotal`

---

## 2. Non-goals (explicit)

- No edits to `transactions.service.ts`, `transactions.module.ts`, `app.module.ts` — reviewed, nothing worth changing.
- No comment additions (step-order comments rejected — self-documenting-code rule).
- No interface restyling, no import restyle, no `formatCents` rewrite, no gate/log reordering.
- Net delta: +1 line on 59 (fee-rules) — far below the 25%-of-LOC threshold; no TODO escalation needed.

## 3. Rejected-candidates log (for the planner)

| Candidate | Verdict | One-line reason |
|---|---|---|
| Compact one-line interfaces vs expanded form | REJECT | Each form matches its field count (2 fields fit one line, 3 do not); no prettier/printWidth enforces a single style; unifying is churn. |
| "Redundant intermediate" structure (`ids`, `response`, context objects) | REJECT | Each intermediate is named, typed, and reused; `new CreateTransactionResponseDto()` + field assign is mandated by impl-plan §4.3 (object literal can't target a class instance). |
| `formatCents` sign branch (negative cents unreachable?) | KEEP DEFENSIVE | Unreachable today (`@IsPositiveDecimalString` on `value`, fee "2"/"4" → factor 96/98 > 0), but removal makes the pure, unit-test-targeted formatter partially defined over cents domain for a 2-line saving; T5-G5 chose the defensive stance. |
| Hoist `DECIMAL_SCALE - Number(discountPercent)` | AGREE → Step 1 | Only 3-deep nested-paren expression in the new code; named local resolves it with zero behavior change. |
| `create()` step-order comments | REJECT | Adding comments is anti-simplification; helper names already mirror the 9-step flow (self-documenting-code rule). |
| Multi-line single-import braces in service | REJECT | Style dictated by impl-plan §3.2 Step 2 ("pick one import per line as shown"); lint-clean as committed. |
| Extract `buildResponse(...)` helper | REJECT | Adds a helper for 3 assignment lines — churn, no clarity gain. |
| Invert `if (!this.shouldReturnBody())` guard | REJECT | Current guard-clause shape is already the single-section, flattest form. |
