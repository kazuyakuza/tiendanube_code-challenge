/**
 * Application entry point (TODO-02 §3).
 *
 * Boot order, all AFTER `NestFactory.create(AppModule)`:
 * helmet → CORS → morgan → global ValidationPipe → URI versioning →
 * Swagger UI (gated by SWAGGER_ENABLED) → listen on the validated PORT.
 *
 * Configuration is read only through the validated `ConfigService` +
 * `ConfigKeys` (TODO-02 §2): PORT arrives as a coerced integer, CORS_ORIGINS
 * as an optional comma-separated allowlist (absent ⇒ all origins allowed),
 * SWAGGER_ENABLED as a real boolean (absent ⇒ true).
 *
 * Versioning interplay: URI versioning prefixes controllers with `/v1`
 * (`defaultVersion: '1'`); the unversioned health endpoint (TODO-02 §4, T4)
 * opts out with `VERSION_NEUTRAL` from `@nestjs/common` in its own cycle.
 *
 * Run guide: `docs/app-setup.md`.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { ConfigKeys } from './config/config.keys';
import { NodeEnvironment } from './config/env.validation';

/** DocumentBuilder metadata (TODO-02 §3.5). T5 (§5.3) adds the x-api-key scheme. */
const SWAGGER_TITLE = 'Tiendanube Code Challenge — Orchestration API';
const SWAGGER_DESCRIPTION =
  'NestJS orchestration API that coordinates the external services of the Tiendanube code challenge.';
const SWAGGER_VERSION = '1.0';
const SWAGGER_UI_PATH = 'docs';

/**
 * Creates, configures and starts the application (TODO-02 §3).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: resolveCorsOrigins(configService.get<string>(ConfigKeys.CorsOrigins)) });
  app.use(morgan(resolveHttpLogFormat(configService.getOrThrow<string>(ConfigKeys.NodeEnv))));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  if (configService.get<boolean>(ConfigKeys.SwaggerEnabled, true)) {
    setupSwagger(app);
  }

  await app.listen(configService.getOrThrow<number>(ConfigKeys.Port));
}

/**
 * Maps CORS_ORIGINS to the `origin` option: absent/blank ⇒ `true` (allow all,
 * dev-friendly); otherwise the trimmed, non-empty origin list. Tightening for
 * production is a one-line .env change (see .env.example).
 */
function resolveCorsOrigins(rawOrigins?: string): string[] | boolean {
  const origins = (rawOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : true;
}

/**
 * Chooses the morgan format: concise `dev` in development, full `combined`
 * otherwise (production and test). Express middleware registered before
 * listen, so every incoming HTTP request — today's catch-all 404s included,
 * like every route added in later tasks — is logged to stdout (plan risk R2).
 */
function resolveHttpLogFormat(nodeEnv?: string): 'dev' | 'combined' {
  if (nodeEnv === NodeEnvironment.Development) {
    return 'dev';
  }
  return 'combined';
}

/**
 * Builds and mounts the Swagger UI at `/docs` (TODO-02 §3.5). Deliberately a
 * standalone function so T5 (TODO-02 §5.3) can extend the DocumentBuilder
 * chain with the x-api-key security scheme without reshaping this file.
 */
function setupSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, swaggerDocument);
}

void bootstrap();
