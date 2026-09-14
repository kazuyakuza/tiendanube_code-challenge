/**
 * Pure card-number masking helper (TODO-03 §4).
 *
 * Returns ONLY the last 4 characters of the full card number — the format
 * json-server stores and the response DTO returns (brief §3.2: masked card
 * number). Request-side validation lives in `CreateTransactionDto`; this
 * function performs no validation. Unit tests arrive in a later TODO.
 */
const MASKED_DIGIT_COUNT = 4;

export function maskCardNumber(fullCardNumber: string): string {
  return fullCardNumber.slice(-MASKED_DIGIT_COUNT);
}
