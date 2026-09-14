/**
 * json-server client resource-path constants (TODO-04 §2.2).
 *
 * The two collection names the client POSTs to, kept as named constants per
 * the avoid-magic-strings rule. NO timeout constant lives here — the HTTP
 * timeout belongs to the module-registration task (TODO-04 Task 3, global
 * plan G12; `HttpModule.register`, decision T1-D7).
 *
 * AI-agent guidance: do not inline these path segments in the service; import
 * them from this file so a resource rename is a one-line change.
 */

/** json-server collection for created transactions. */
export const TRANSACTIONS_RESOURCE_PATH = 'transactions';

/** json-server collection for created receivables. */
export const RECEIVABLES_RESOURCE_PATH = 'receivables';
