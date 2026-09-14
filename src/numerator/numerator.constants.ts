/**
 * Numerator client tuning constants (TODO-04 §1.3, global plan G1/G2/G4).
 *
 * MAX_RETRIES and NUMERATOR_BASE_BACKOFF_MS are OPTIONAL env vars — these
 * constants are their in-code defaults, so existing `.env` files keep booting
 * unchanged (G3). `MAX_NUMERATOR_BACKOFF_MS` caps the light exponential
 * backoff curve `min(base * 2^retryIndex, cap)`; `CAS_CONFLICT_STATUS` names
 * the HTTP status the mock returns on a CAS conflict (magic-number rule).
 *
 * AI-agent guidance: do not re-declare these numbers elsewhere; the retry
 * semantics live in `numerator.service.ts` and the env plumbing in
 * `src/config/env.validation.ts` / `config.keys.ts`.
 */

/** Default total CAS attempts per `getNextId()` call (env `MAX_RETRIES`). */
export const NUMERATOR_DEFAULT_MAX_RETRIES = 10;

/** Default base backoff in ms for the first retry (env `NUMERATOR_BASE_BACKOFF_MS`). */
export const NUMERATOR_DEFAULT_BASE_BACKOFF_MS = 20;

/** Upper bound of the exponential backoff curve, in ms. */
export const MAX_NUMERATOR_BACKOFF_MS = 160;

/** HTTP status the Numerator mock returns for a CAS conflict. */
export const CAS_CONFLICT_STATUS = 400;
