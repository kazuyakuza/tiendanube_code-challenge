/**
 * Shared API-key constants (TODO-02 §5).
 *
 * Single source of truth for the API-key wire format: the HTTP header name
 * (`API_KEY_HEADER`) is used by `ApiKeyGuard` when reading the request and by
 * the Swagger setup in `main.ts` when declaring the security scheme; the
 * scheme reference name (`API_KEY_SECURITY_SCHEME`) ties the Swagger "Authorize"
 * button to that scheme. This file intentionally imports nothing.
 */
export const API_KEY_HEADER = 'x-api-key';

/** OpenAPI security-scheme reference name shown by the Swagger Authorize button. */
export const API_KEY_SECURITY_SCHEME = 'API-Key';
