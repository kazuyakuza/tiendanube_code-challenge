/**
 * Domain error classes for the Numerator client (TODO-04 §1.4, global plan G8).
 *
 * Taxonomy:
 * - `NumeratorUnavailableError` — the Numerator service could not be used:
 *   network/timeout failures, 5xx, or any unexpected HTTP status. Carries the
 *   underlying message; the axios stack is intentionally NOT propagated.
 * - `NumeratorRetriesExhaustedError` — every CAS attempt conflicted. Carries
 *   the configured attempt budget and the last current value observed, if any.
 * - `InvalidNumeratorValueError` — the API returned a non-finite/non-numeric
 *   numerator, or the candidate overflowed the safe-integer range. Carries the
 *   offending raw value.
 *
 * AI-agent guidance: mapping these to HTTP responses (e.g. 503) is the
 * orchestration layer's job, NOT this client's (global plan G18) — no status
 * codes belong in this file.
 */

export class NumeratorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NumeratorUnavailableError';
  }
}

export class NumeratorRetriesExhaustedError extends Error {
  readonly maxRetries: number;
  readonly lastKnownCurrent: number | undefined;

  constructor(maxRetries: number, lastKnownCurrent?: number) {
    const currentSuffix =
      lastKnownCurrent === undefined ? '' : ` (last known current: ${lastKnownCurrent})`;
    super(`Numerator ID reservation failed after ${maxRetries} attempts${currentSuffix}`);
    this.name = 'NumeratorRetriesExhaustedError';
    this.maxRetries = maxRetries;
    this.lastKnownCurrent = lastKnownCurrent;
  }
}

export class InvalidNumeratorValueError extends Error {
  readonly rawValue: unknown;

  constructor(rawValue: unknown) {
    super(`Numerator returned an invalid value: ${String(rawValue)}`);
    this.name = 'InvalidNumeratorValueError';
    this.rawValue = rawValue;
  }
}
