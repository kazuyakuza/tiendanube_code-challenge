/**
 * Lifecycle status of a receivable (TODO-03 §3).
 *
 * `paid` — debit_card receivables, settled same day (D+0).
 * `waiting_funds` — credit_card receivables, settled 30 days after creation.
 * String values match the json-server seed (`config/db.json`).
 *
 * AI-agent guidance: wire value invariant — `ReceivableResponseDto.status`
 * serializes to these strings. The debit→`paid` / credit→`waiting_funds`
 * mapping is business logic implemented since TODO-05 in
 * `resolveReceivableStatus` (`src/transactions/fee-rules.ts`), called by
 * `TransactionsService` — this enum's first business consumer.
 */
export enum ReceivableStatus {
  PAID = 'paid',
  WAITING_FUNDS = 'waiting_funds',
}
