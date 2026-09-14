/**
 * Shared outbound-HTTP Axios timeout (TODO-04 §"Configuration & resilience",
 * global plan G12): a hanging external service must not block a request
 * indefinitely, so every client module's `HttpModule.register({ timeout })`
 * reads this constant — never re-declare the 4000 anywhere.
 *
 * AI-agent guidance: source `.env` URLs stay in validated config only; this
 * file owns the resilience knob. If the timeout value ever needs to become
 * operator-tunable, that is a new decision for the owning TODO, not a local
 * edit.
 */

export const HTTP_TIMEOUT_MS = 4000;
