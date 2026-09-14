/**
 * Feature module for the json-server client (TODO-04 §2.3, T1-D1 precedent).
 *
 * Imports `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` (TODO-04
 * §"Configuration & resilience", G12): `@nestjs/axios` v4 has NO `forRoot`,
 * and `register` (dist/http.module.js) gives THIS module its own isolated
 * axios instance pre-configured with the 4 s timeout — separate from the
 * Numerator client's instance.
 *
 * Exports `JsonServerService`, and this module is imported in `AppModule`
 * (G14), so the Transactions module (next TODOs) can simply add
 * `JsonServerModule` to its `imports` and inject `JsonServerService`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { JsonServerService } from './json-server.service';

@Module({
  imports: [HttpModule.register({ timeout: HTTP_TIMEOUT_MS })],
  providers: [JsonServerService],
  exports: [JsonServerService],
})
export class JsonServerModule {}
