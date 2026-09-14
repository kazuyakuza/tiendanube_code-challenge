/**
 * Parameter object for constructing `JsonServerRequestError` (keeps the
 * constructor within the 2-params rule) and for the failure log line.
 *
 * AI-agent guidance: `status` is `number | undefined` EXPLICITLY (not an
 * optional `?` property) so callers must always pass the key — `undefined`
 * means "no HTTP status existed" (network/timeout/non-axios failure).
 * `reason` is axios-generated text (e.g. "Request failed with status code
 * 400"); it must NEVER be taken from the upstream response body, which could
 * echo card data (TODO §Configuration & resilience).
 */
export interface JsonServerRequestFailure {
  /** json-server resource path the failed call targeted. */
  resource: string;
  /** HTTP status when one exists; `undefined` for network/timeout/non-axios failures. */
  status: number | undefined;
  /** Safe, payload-free failure reason (axios-generated text). */
  reason: string;
}
