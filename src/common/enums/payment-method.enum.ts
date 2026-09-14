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
 * (`@IsEnum`) today; consumed since TODO-05 by the orchestration service
 * (`TransactionsService` + `src/transactions/fee-rules.ts` — status/fee
 * lookups keyed on this enum). Reachable over HTTP since TODO-06 Cycle A:
 * `POST /v1/transactions` (`TransactionsController`) validates and
 * persists payloads keyed on these values.
 */
export enum PaymentMethod {
  DEBIT_CARD = 'debit_card',
  CREDIT_CARD = 'credit_card',
}
