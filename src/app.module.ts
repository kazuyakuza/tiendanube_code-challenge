/**
 * Root application module.
 *
 * Registers the global, cached ConfigModule with fail-fast environment
 * validation (TODO-02 §2): `ConfigService` can be injected anywhere without
 * re-importing, and startup aborts with a readable error when a required
 * variable is missing or invalid. Later sections of
 * `.agent/todos/20260913/20260913-todo-2.md` add the health module (§4) and
 * the global API-key guard via `APP_GUARD` (§5). Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => validateEnv(config),
    }),
  ],
})
export class AppModule {}
