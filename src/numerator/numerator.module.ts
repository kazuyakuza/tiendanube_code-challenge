/**
 * Feature module for the Numerator client (TODO-04 §1.5, decision T1-D1).
 *
 * Imports `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (TODO-04
 * §"Configuration & resilience", G12): `@nestjs/axios` v4 has NO `forRoot`,
 * and `register` (dist/http.module.js) gives THIS module its own isolated
 * axios instance pre-configured with the 4 s timeout — NumeratorModule's
 * `HttpService` is independent of any other client's instance.
 *
 * Exports `NumeratorService`, and this module is imported in `AppModule`
 * (G14), so the Transactions module (next TODOs) can simply add
 * `NumeratorModule` to its `imports` and inject `NumeratorService`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { NumeratorService } from './numerator.service';

@Module({
  imports: [HttpModule.register({ timeout: HTTP_TIMEOUT_MS })],
  providers: [NumeratorService],
  exports: [NumeratorService],
})
export class NumeratorModule {}
