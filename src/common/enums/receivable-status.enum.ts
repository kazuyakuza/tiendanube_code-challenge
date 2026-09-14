/**
 * Lifecycle status of a receivable (TODO-03 §3).
 *
 * `paid` — debit_card receivables, settled same day (D+0).
 * `waiting_funds` — credit_card receivables, settled 30 days after creation.
 * String values match the json-server seed (`config/db.json`).
 */
export enum ReceivableStatus {
  PAID = 'paid',
  WAITING_FUNDS = 'waiting_funds',
}
