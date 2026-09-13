/**
 * Canonical environment-variable key names exposed by ConfigService.
 *
 * Use `ConfigKeys.*` (via `configService.get(ConfigKeys.PORT)`) instead of
 * literal key strings so that a renamed variable is caught by the compiler
 * and instruments stay typo-free. The values must match the keys declared in
 * `src/config/env.validation.ts` and documented in `.env.example`.
 *
 * Consumers: main.ts bootstrap (T3), api-key guard (T5), external-service
 * clients (later TODOs).
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

export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];
