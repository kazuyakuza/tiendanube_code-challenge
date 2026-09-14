/**
 * Parameter object for classifying a failed json-server POST inside
 * `JsonServerService` (keeps `toRequestError` within the 2-params rule).
 *
 * AI-agent guidance: `error` is the raw caught value (`unknown` on purpose —
 * axios rejections are `AxiosError`, but anything can be thrown); the service
 * narrows it with `isAxiosError` before reading a status.
 */
export interface JsonServerErrorContext {
  /** json-server resource path the failed call targeted (e.g. `transactions`). */
  resource: string;
  /** Raw caught error from the HTTP call. */
  error: unknown;
}
