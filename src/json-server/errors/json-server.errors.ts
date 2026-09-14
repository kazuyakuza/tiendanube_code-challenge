/**
 * Domain error class for the json-server client (TODO-04 §2.3, global plan G8).
 *
 * `JsonServerRequestError` — a POST to a json-server resource failed: 4xx/5xx
 * response, network/timeout failure, or any non-axios error. Carries the
 * resource path, the HTTP status when one exists (`undefined` otherwise) and
 * a payload-free reason, so the orchestration layer can decide what to do
 * (fail-fast — this client never retries, TODO §Out of scope).
 *
 * AI-agent guidance: mapping this error to HTTP responses is the orchestration
 * layer's job, NOT this client's (global plan G18) — no status codes are
 * thrown from here. The mapping is LIVE since TODO-06 Cycle B: the global
 * `AllExceptionsFilter` (`src/common/filters/`) answers unknown/5xx statuses
 * with 503 and 4xx with 502, carrying this message verbatim. The message is
 * built ONLY from resource + status + axios-generated reason text; upstream
 * response bodies are never interpolated (card-data privacy, TODO
 * §Configuration & resilience).
 */
import type { JsonServerRequestFailure } from '../interfaces/json-server-request-failure.interface';

export class JsonServerRequestError extends Error {
  readonly resource: string;
  readonly status: number | undefined;

  constructor(failure: JsonServerRequestFailure) {
    super(buildRequestErrorMessage(failure));
    this.name = 'JsonServerRequestError';
    this.resource = failure.resource;
    this.status = failure.status;
  }
}

function buildRequestErrorMessage(failure: JsonServerRequestFailure): string {
  return `json-server request failed — resource=${failure.resource}, status=${failure.status ?? 'unknown'}, reason=${failure.reason}`;
}
