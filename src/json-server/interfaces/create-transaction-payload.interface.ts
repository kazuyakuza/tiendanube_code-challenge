/**
 * Transport payload for `POST {JSON_SERVER_URL}/transactions` (TODO-04 §2.4,
 * global plan G10). Transport-only: the json-server client does NOT calculate
 * fees, mask card numbers, generate ids, or default any field — the caller
 * supplies every value verbatim, including the Numerator-generated `id` and
 * the ALREADY-MASKED last-4 `cardNumber`.
 *
 * AI-agent guidance: deliberately NOT reused from `CreateTransactionDto` —
 * that request DTO carries the full 13–19-digit PAN and has no `id` field
 * (TODO-03 contract), which is the wrong shape for this wire payload.
 * `method` uses the shared `PaymentMethod` enum type (wire values
 * `debit_card` / `credit_card`, matching the json-server seed `config/db.json`).
 */
import type { PaymentMethod } from '../../common/enums/payment-method.enum';

export interface CreateTransactionPayload {
  /** Unique id generated via the Numerator API (string per json-server convention). */
  id: string;
  /** Transaction amount as a string (json-server stores string amounts). */
  value: string;
  /** Purchase description as received. */
  description: string;
  /** Payment method; decides the receivable status upstream, not here. */
  method: PaymentMethod;
  /** Already-masked card number (last 4 digits) — masking happens upstream via `maskCardNumber()` (`src/common/utils/card-number.util.ts`), NOT in this client. */
  cardNumber: string;
  /** Cardholder name as received. */
  cardHolderName: string;
  /** Card expiration date in MM/YY format as received. */
  cardExpirationDate: string;
  /** Card verification code as received. */
  cardCvv: string;
}
