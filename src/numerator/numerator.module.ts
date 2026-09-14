/**
 * Feature module for the Numerator client (TODO-04 §1.5, decision T1-D1).
 *
 * Imports the BARE `HttpModule` (valid in @nestjs/axios v4: the class itself
 * provides + exports `HttpService` with the default axios instance — no
 * timeout yet). Exports `NumeratorService` so later modules can inject it.
 *
 * AI-agent guidance: the module-registration task (TODO-04 Task 3) upgrades
 * this import to the timeout-configured form (`HttpModule.register` — note
 * `forRoot` does NOT exist in v4) and registers this module in `AppModule`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { NumeratorService } from './numerator.service';

@Module({
  imports: [HttpModule],
  providers: [NumeratorService],
  exports: [NumeratorService],
})
export class NumeratorModule {}
