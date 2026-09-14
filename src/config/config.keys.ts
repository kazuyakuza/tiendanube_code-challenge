/**
 * Canonical environment-variable key names exposed by ConfigService.
 *
 * AI-agent guidance: always read config via
 * `configService.get(ConfigKeys.Port)` — never literal key strings — so a
 * renamed variable is caught by the compiler and consumers stay typo-free.
 * Values must match, field by field, the keys declared in
 * `src/config/env.validation.ts` (validated at bootstrap) and documented in
 * `.env.example` / `docs/app-setup.md`. As of the §3 bootstrap hardening (T3)
 * there are no direct `process.env` reads left in `main.ts` — every bootstrap
 * config lookup goes through these constants.
 *
 * Consumption map: Port / NodeEnv / CorsOrigins / SwaggerEnabled → main.ts
 * bootstrap (TODO-02 §3, implemented, per plan addendum A3-R); ApiKey →
 * global ApiKeyGuard (§5, T5, implemented — `src/common/guards/api-key.guard.ts`,
 * registered via `APP_GUARD` in `app.module.ts`); NumeratorApiUrl /
 * MaxRetries / NumeratorBaseBackoffMs → NumeratorService (TODO-04 Task 1,
 * implemented — `src/numerator/numerator.service.ts`; URL via `getOrThrow`,
 * optional knobs via `get(key, default)`); JsonServerUrl → JsonServerService
 * (TODO-04 Task 2, implemented — `src/json-server/json-server.service.ts`;
 * URL via `getOrThrow`). TransactionsReturnBody → `TransactionsService`
 * (TODO-05, implemented — `src/transactions/transactions.service.ts`;
 * service-level gate via `get(key, true)`: `create()` returns the
 * `{ transaction, receivable }` envelope or `undefined`; since TODO-06
 * Cycle A `TransactionsController` relays `undefined` as the bare `201`,
 * so the gate is HTTP-observable on `POST /v1/transactions`).
 */
export const ConfigKeys = {
  NodeEnv: 'NODE_ENV',
  Port: 'PORT',
  NumeratorApiUrl: 'NUMERATOR_API_URL',
  JsonServerUrl: 'JSON_SERVER_URL',
  ApiKey: 'API_KEY',
  SwaggerEnabled: 'SWAGGER_ENABLED',
  CorsOrigins: 'CORS_ORIGINS',
  TransactionsReturnBody: 'TRANSACTIONS_RETURN_BODY',
  MaxRetries: 'MAX_RETRIES',
  NumeratorBaseBackoffMs: 'NUMERATOR_BASE_BACKOFF_MS',
} as const;

/** Union of the valid key literals; use it to type key parameters/maps. */
export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];
