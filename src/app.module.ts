/**
 * Root application module scaffolded by TODO-02 §1 (project bootstrap).
 *
 * Intentionally empty: later sections of
 * `.agent/todos/20260913/20260913-todo-2.md` register the global
 * `ConfigModule` with env validation (§2), the health module (§4) and the
 * global API-key guard via `APP_GUARD` (§5). Do not pre-wire them here.
 * Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
