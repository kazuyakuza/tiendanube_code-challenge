# Simplification Plan — TODO-06 Cycle B, step 4.3 (Simplifier, Cycle B)

Branch: `feat/transactions-endpoint` (commits `2416915`, `1b73935`, `271c94b`).
Binding context: `.kilo/plans/20260914-error-handling-compensation.md` (CB-D1…CB-D8) — none of the decisions below change any CB-D decision; both edits preserve behavior exactly.

## Summary

Two micro-simplifications, both behavior-preserving:

1. Stale comment fix in `transactions.module.ts` (the "Cycle-B compensation wiring" justification is obsolete — Cycle B landed and never consumed the `TransactionsService` export).
2. Dead-computation removal in `transaction-compensation.service.ts` (`reason` is computed before the 404 early-return that never uses it).

Rejected (do NOT implement): shared `normalizeBaseUrl`/`sleep` util (over-engineering for 2 one-line call sites; blocked by G7 zero-diffs on `src/json-server/` and CB-D4 "inline sleep"); extracting `describeError` for the service's inline ternary (plan-verbatim §5.4d, marginal); pruning `HTTP_STATUS_PHRASES` entries (defensive completeness, CB-D2 plan-verbatim map); any boolean-condition restructuring (cross-cutting rule — belongs to code-reviewer).

## Step 1 — Stale comment in `src/transactions/transactions.module.ts`

**Why:** lines 11–12 say the service "stays EXPORTED for future consumers (tests, Cycle-B compensation wiring)". Cycle B is now in this same module and wired `TransactionCompensationService` directly; it never consumed the `TransactionsService` export, so the justification misleads future agents.

**BEFORE (lines 10–12):**
```typescript
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. The service stays EXPORTED for future consumers (tests, Cycle-B
 * compensation wiring).
```

**AFTER:**
```typescript
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. The service stays EXPORTED for future consumers (e.g. tests); Cycle-B
 * compensation wiring did not need it — `TransactionCompensationService` is
 * provided here directly.
```

**Do NOT** touch `exports: [TransactionsService]` (removing it is an API change, plan-frozen in §5.3).

## Step 2 — Dead computation in `src/transactions/transaction-compensation.service.ts`

**Why:** in `handleDeleteFailure`, `const reason = describeError(context.error)` (line 86) runs on every failure, but the 404-success branch (lines 87–92) returns early without using it. Move the computation after that branch. `describeError` is pure, so behavior is identical; the success path stops computing a discarded string.

**BEFORE (lines 85–92):**
```typescript
  private async handleDeleteFailure(context: CompensationFailureContext): Promise<boolean> {
    const reason = describeError(context.error);
    if (this.isAlreadyAbsent(context.error)) {
      this.logger.warn(
        `compensation succeeded — transaction ${context.transactionId} already absent (attempt ${context.attempt})`,
      );
      return true;
    }
```

**AFTER:**
```typescript
  private async handleDeleteFailure(context: CompensationFailureContext): Promise<boolean> {
    if (this.isAlreadyAbsent(context.error)) {
      this.logger.warn(
        `compensation succeeded — transaction ${context.transactionId} already absent (attempt ${context.attempt})`,
      );
      return true;
    }
    const reason = describeError(context.error);
```

Nothing else in the method uses `reason` before line 93; lines 93–104 are unchanged.

## Verification (both steps)

```
npm run build
npm run lint
```

Both must pass with zero errors. No behavior/test-script re-run required: Step 1 is comment-only; Step 2 only reorders a pure computation relative to an early return.

## Out-of-scope findings (report back, not planned here)

- `docs/app-setup.md` still documents Cycle B as pending: "zero try/catch" claim at line 699, plus stale "Cycle B pending / not yet implemented" wording at lines ~29, ~209, ~509, ~545, ~618, ~751, ~908, ~933. Handled by step 4.4 (docs-specialist), not by this simplification pass.
