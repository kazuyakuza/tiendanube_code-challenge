/**
 * Validated environment schema consumed by `ConfigModule.forRoot({ validate })`.
 *
 * Every variable a process env/dotenv supplies arrives as a raw STRING, so the
 * `PORT` coercion is done explicitly with class-transformer's `@Type`
 * decorator instead of scattered `parseInt` calls. Validation runs at
 * bootstrap and throwing here prevents the application from starting (see
 * `@nestjs/config` ConfigModuleOptions.validate contract).
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

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT: number;

  @IsUrl({ require_tld: false, require_protocol: true })
  NUMERATOR_API_URL: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  JSON_SERVER_URL: string;

  @IsString()
  @IsNotEmpty()
  API_KEY: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolString(value))
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string;
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
