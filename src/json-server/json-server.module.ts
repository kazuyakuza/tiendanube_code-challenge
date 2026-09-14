/**
 * Feature module for the json-server client (TODO-04 §2.3, T1-D1 precedent).
 *
 * Imports the BARE `HttpModule` (valid in @nestjs/axios v4: the class itself
 * provides + exports `HttpService` with the default axios instance — no
 * timeout yet). Exports `JsonServerService` so later modules can inject it.
 *
 * AI-agent guidance: the module-registration task (TODO-04 Task 3) upgrades
 * this import to the timeout-configured form (`HttpModule.register` — note
 * `forRoot` does NOT exist in v4, decision T1-D7) and registers this module
 * in `AppModule` (global plan G14).
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JsonServerService } from './json-server.service';

@Module({
  imports: [HttpModule],
  providers: [JsonServerService],
  exports: [JsonServerService],
})
export class JsonServerModule {}
