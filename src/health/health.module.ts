/**
 * Feature module for the public liveness probe (TODO-02 §4).
 *
 * Declares `HealthController` (`HEAD /health/ping`). Imports nothing — the
 * global `ConfigModule` (`isGlobal: true`, TODO-02 §2) needs no re-import —
 * and exports nothing, since no other module consumes health.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
