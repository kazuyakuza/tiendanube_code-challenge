/**
 * Payment methods accepted by `POST /v1/transactions` (TODO-03 §3).
 *
 * Shared by the request DTO (`method` field), the transaction response DTO
 * and the fee constants (`src/common/constants/payment-fee.constants.ts`).
 * String-valued so the wire format matches the json-server seed
 * (`config/db.json`: `"debit_card"` / `"credit_card"`).
 *
 * AI-agent guidance: wire value invariant — the serialized form is always
 * the enum member's string, never its name. Consumed by `CreateTransactionDto`
 * (`@IsEnum`) today; the TODO-04 controller/service and their specs are the
 * next consumers. Nothing here is reachable from an HTTP route yet.
 */
export enum PaymentMethod {
  DEBIT_CARD = 'debit_card',
  CREDIT_CARD = 'credit_card',
}
