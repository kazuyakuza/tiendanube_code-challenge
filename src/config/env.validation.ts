/**
 * Validated environment schema (TODO-02 §2) consumed by
 * `ConfigModule.forRoot({ validate })` — registered global + cached in
 * `src/app.module.ts`.
 *
 * Fail-fast contract: validation runs during bootstrap; any missing or invalid
 * variable throws a single error naming every offending variable, so the app
 * refuses to start. Values arriving from process.env/dotenv are raw STRINGS;
 * `PORT` is coerced explicitly with class-transformer's `@Type` (never
 * scattered `parseInt`), and ConfigService serves this validated, coerced
 * instance app-wide (see `@nestjs/config` ConfigModuleOptions.validate).
 *
 * AI-agent guidance:
 * - Read config via `ConfigService` + `ConfigKeys` (`src/config/config.keys.ts`),
 *   never literal key strings. Since T3 this holds application-wide: the
 *   bootstrap's former temporary `process.env.PORT` read is gone.
 * - Consumption map: PORT / NODE_ENV / CORS_ORIGINS / SWAGGER_ENABLED →
 *   `main.ts` bootstrap (T3, implemented; required keys via `getOrThrow`,
 *   `SWAGGER_ENABLED` via `get(key, true)` — plan addendum A3-R); API_KEY →
 *   global ApiKeyGuard (T5, implemented — `src/common/guards/api-key.guard.ts`,
 *   read via `getOrThrow`); NUMERATOR_API_URL / MAX_RETRIES /
 *   NUMERATOR_BASE_BACKOFF_MS → NumeratorService (TODO-04 Task 1,
 *   implemented — `src/numerator/numerator.service.ts`; URL via `getOrThrow`,
 *   the two optional knobs via `get(key, default)`); JSON_SERVER_URL →
 *   JsonServerService (TODO-04 Task 2, implemented —
 *   `src/json-server/json-server.service.ts`; URL via `getOrThrow`).
 *   TRANSACTIONS_RETURN_BODY → `TransactionsService` (TODO-05,
 *   implemented — `src/transactions/transactions.service.ts`; read per
 *   `create()` via `get(key, true)`; gate: envelope returned or
 *   `undefined` — since TODO-06 Cycle A `TransactionsController` relays
 *   `undefined` as a bare `201`, making the gate HTTP-observable on
 *   `POST /v1/transactions`).
 *   All ten are *validated* at bootstrap.
 * - URL fields require a protocol (`require_protocol`, plan addendum A4-R):
 *   protocol-less garbage fails at startup instead of at the first HTTP call.
 * - Adding a required field here also requires updating `.env.example` and
 *   `docs/app-setup.md`, otherwise every existing local `.env` fails to boot.
 */
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
  ValidationError,
} from 'class-validator';

const urlValidationOptions = { require_tld: false, require_protocol: true };

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Single source of truth for the variables the app requires/accepts. Public
 * props are intentional (data holder read by ConfigService — justified
 * exception to the private-by-default rule).
 */
class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT: number;

  @IsUrl(urlValidationOptions)
  NUMERATOR_API_URL: string;

  @IsUrl(urlValidationOptions)
  JSON_SERVER_URL: string;

  @IsString()
  @IsNotEmpty()
  API_KEY: string;

  /** Optional; absent keeps the initializer `true` (T3 gates `/docs` on it). */
  @IsOptional()
  @Transform(({ value }) => transformBoolString(value))
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  /** Optional; absent ⇒ all origins allowed (T3 CORS reads this allowlist). */
  @IsOptional()
  @IsString()
  CORS_ORIGINS: string;

  /** Optional; absent keeps the default `true`. Gate lives at the SERVICE layer since TODO-05 (`TransactionsService.create` returns the { transaction, receivable } envelope, or `undefined` when `false`); since TODO-06 Cycle A `TransactionsController` relays the result directly, so the endpoint's bare-`201 CREATED` shape (TODO-03 §2.4) is live on `POST /v1/transactions`. */
  @IsOptional()
  @Transform(({ value }) => transformBoolString(value))
  @IsBoolean()
  TRANSACTIONS_RETURN_BODY: boolean = true;

  /** Optional; absent keeps the Numerator client default of 10 total CAS attempts (TODO-04 §1.3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_RETRIES: number;

  /** Optional; absent keeps the Numerator client base backoff of 20 ms (TODO-04 §1.3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  NUMERATOR_BASE_BACKOFF_MS: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedEnv = plainToInstance(EnvironmentVariables, config);
  const validationErrors = validateSync(validatedEnv, { skipMissingProperties: false, whitelist: false });
  if (validationErrors.length > 0) {
    throw new Error(buildErrorMessage(validationErrors));
  }
  return validatedEnv;
}

function transformBoolString(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

function buildErrorMessage(errors: ValidationError[]): string {
  const entries = errors.map((error) => {
    const messages = Object.values(error.constraints ?? {});
    return `  - ${error.property}: ${messages.join(', ')}`;
  });
  return `Invalid environment configuration. Fix .env (reference: .env.example):\n${entries.join('\n')}`;
}
