/**
 * Root application module.
 *
 * Registers the global, cached ConfigModule with fail-fast environment
 * validation (TODO-02 §2): `ConfigService` can be injected anywhere without
 * re-importing, and startup aborts with a readable error when a required
 * variable is missing or invalid. Imports HealthModule (TODO-02 §4, the
 * public unversioned `HEAD /health/ping` probe, exempted from auth via
 * `@Public()`).
 *
 * External clients (TODO-04 Task 3, G14): `NumeratorModule` and
 * `JsonServerModule` are registered here, making both services injectable
 * anywhere; each carries its own timeout-configured axios instance
 * (`HTTP_TIMEOUT_MS`). There is still NO business route/controller — the
 * clients perform zero outbound HTTP calls until the orchestration TODO
 * (later) wires them to an endpoint.
 *
 * Security (TODO-02 §5): `ApiKeyGuard` is registered globally through the
 * `APP_GUARD` token, so every route requires the `x-api-key` header unless
 * exempted with `@Public()`. Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { NumeratorModule } from './numerator/numerator.module';
import { JsonServerModule } from './json-server/json-server.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    HealthModule,
    NumeratorModule,
    JsonServerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
