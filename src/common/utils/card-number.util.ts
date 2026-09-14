/**
 * Pure card-number masking helper (TODO-03 §4).
 *
 * Returns ONLY the last 4 characters of the full card number — the format
 * json-server stores and the response DTO returns (brief §3.2: masked card
 * number). Request-side validation lives in `CreateTransactionDto`; this
 * function performs no validation.
 *
 * AI-agent guidance: wire value invariant — the stored/returned
 * `cardNumber` is ALWAYS the 4-digit result of this function (last 4
 * digits), never the full PAN; the request DTO accepts the number in full.
 * TODO-04: call this in the transaction service before persisting/responding;
 * unit tests arrive with the same TODO.
 */
const MASKED_DIGIT_COUNT = 4;

/**
 * @param fullCardNumber card number as received (the `CreateTransactionDto`
 * contract guarantees a 13–19 digit string for API payloads; this helper
 * itself validates nothing).
 * @returns the last 4 characters of `fullCardNumber` (shorter input is
 * returned unchanged — unreachable through a valid request payload).
 */
export function maskCardNumber(fullCardNumber: string): string {
  return fullCardNumber.slice(-MASKED_DIGIT_COUNT);
}
