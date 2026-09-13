/**
 * Canonical environment-variable key names exposed by ConfigService.
 *
 * AI-agent guidance: always read config via
 * `configService.get(ConfigKeys.Port)` — never literal key strings — so a
 * renamed variable is caught by the compiler and consumers stay typo-free.
 * Values must match, field by field, the keys declared in
 * `src/config/env.validation.ts` (validated at bootstrap) and documented in
 * `.env.example` / `docs/app-setup.md`. No consumer reads these yet: the
 * temporary `process.env.PORT` in `main.ts` is replaced by
 * `ConfigKeys.Port` in T3.
 *
 * Consumption map: Port / CorsOrigins / SwaggerEnabled → main.ts bootstrap
 * (TODO-02 §3, T3); ApiKey → ApiKeyGuard (§5, T5); NumeratorApiUrl /
 * JsonServerUrl → external-service clients (later TODOs).
 */
export const ConfigKeys = {
  NodeEnv: 'NODE_ENV',
  Port: 'PORT',
  NumeratorApiUrl: 'NUMERATOR_API_URL',
  JsonServerUrl: 'JSON_SERVER_URL',
  ApiKey: 'API_KEY',
  SwaggerEnabled: 'SWAGGER_ENABLED',
  CorsOrigins: 'CORS_ORIGINS',
} as const;

/** Union of the valid key literals; use it to type key parameters/maps. */
export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];
