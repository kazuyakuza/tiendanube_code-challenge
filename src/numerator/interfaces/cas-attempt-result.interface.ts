/**
 * Outcome of ONE CAS reservation attempt inside the `getNextId()` loop
 * (TODO-04 §1.3). Parameter/result object keeping service methods within the
 * 2-params rule.
 *
 * AI-agent guidance: `reservedId` is `null` ONLY after a retriable CAS
 * conflict (the loop continues); every other failure throws a domain error
 * instead of returning. `observedCurrent` is the value this attempt read via
 * `GET /numerator`; it feeds the exhausted-retries error context (G8).
 */
export interface CasAttemptResult {
  reservedId: number | null;
  observedCurrent: number;
}
