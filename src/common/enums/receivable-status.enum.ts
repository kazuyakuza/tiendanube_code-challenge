/**
 * Lifecycle status of a receivable (TODO-03 §3).
 *
 * `paid` — debit_card receivables, settled same day (D+0).
 * `waiting_funds` — credit_card receivables, settled 30 days after creation.
 * String values match the json-server seed (`config/db.json`).
 *
 * AI-agent guidance: wire value invariant — `ReceivableResponseDto.status`
 * serializes to these strings. The debit→`paid` / credit→`waiting_funds`
 * mapping itself is business logic owned by TODO-04, which is this enum's
 * next consumer.
 */
export enum ReceivableStatus {
  PAID = 'paid',
  WAITING_FUNDS = 'waiting_funds',
}
