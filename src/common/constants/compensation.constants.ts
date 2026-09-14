/**
 * Partial-failure compensation tuning constants (TODO-06 §Task 2.2, global
 * plan G5; cycle B): retry budget and backoff for
 * `TransactionCompensationService.deleteTransaction`, the DELETE that removes
 * a transaction orphaned by a failed receivable write.
 *
 * AI-agent guidance: NO env keys back these values (G7 — in-code constants
 * only, mirroring `http-timeout.constants.ts`); the goal is to REDUCE
 * orphans, not eliminate them (TODO §2.2) — do not raise the budget into a
 * saga. Never re-declare these numbers elsewhere.
 */

/** Total DELETE attempts per compensation call (no sleep after the last). */
export const COMPENSATION_MAX_ATTEMPTS = 3;

/** Base backoff in ms before the 2nd attempt: min(base × 2^(attempt−1), cap). */
export const COMPENSATION_BASE_BACKOFF_MS = 200;

/** Upper bound of the compensation backoff curve, in ms. */
export const COMPENSATION_MAX_BACKOFF_MS = 1600;
