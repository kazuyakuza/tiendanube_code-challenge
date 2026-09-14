/**
 * Wire shapes of the provided Numerator mock API (`numerator-api/api.js`,
 * TODO-04 §1.2). Transport types only — no validation logic here; runtime
 * values are validated in `NumeratorService` before use.
 *
 * AI-agent guidance: `NumeratorCurrentResponseBody.numerator` is typed
 * `unknown` DELIBERATELY — the service must prove it is a finite number
 * (global plan G7) instead of trusting the wire.
 */

/** `GET /numerator` success body. */
export interface NumeratorCurrentResponseBody {
  numerator: unknown;
}

/** `PUT /numerator/test-and-set` success body (`{ numerator: newValue }`). */
export interface CasSuccessResponseBody {
  numerator: number;
}

/**
 * `PUT /numerator/test-and-set` 400 body. The mock emits TWO variants:
 * CAS conflict → `{ error, currentNumerator }`; invalid params →
 * `{ error }` WITHOUT `currentNumerator`. Only the first is a retryable
 * conflict (global plan G5).
 */
export interface CasConflictResponseBody {
  error?: string;
  currentNumerator?: number;
}
