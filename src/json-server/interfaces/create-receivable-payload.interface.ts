/**
 * Transport payload for `POST {JSON_SERVER_URL}/receivables` (TODO-04 §2.4,
 * global plan G10). Transport-only: every field — including `create_date` —
 * is supplied by the caller verbatim; this client computes nothing (no fee
 * math, no status mapping, no dates).
 *
 * AI-agent guidance: field names keep the json-server wire format
 * (`transaction_id`, `create_date` — snake_case, matching `config/db.json`).
 * `create_date` is a caller-supplied string (ISO-8601 recommended per TODO
 * §2.4; the seed's DD/MM/YYYY format is a known discrepancy owned by the
 * business layer, NOT by this client). `status` uses the shared
 * `ReceivableStatus` enum type (wire values `paid` / `waiting_funds`).
 */
import type { ReceivableStatus } from '../../common/enums/receivable-status.enum';

export interface CreateReceivablePayload {
  /** Unique id generated via the Numerator API (string per json-server convention). */
  id: string;
  /** Id of the originating transaction (also Numerator-generated). */
  transaction_id: string;
  /** `paid` for debit_card (D+0) / `waiting_funds` for credit_card — mapped upstream, not here. */
  status: ReceivableStatus;
  /** Caller-supplied creation date string (ISO-8601 recommended). */
  create_date: string;
  /** Same value as the originating transaction, as a string. */
  subtotal: string;
  /** Fee percentage as a string ("2" debit / "4" credit) — computed upstream, not here. */
  discount: string;
  /** Net amount as a string — computed upstream, not here. */
  total: string;
}
