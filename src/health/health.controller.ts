/**
 * Public liveness probe (TODO-02 §4).
 *
 * An unversioned, key-free endpoint answering `200 OK` with an empty body.
 * Unversioned via `VERSION_NEUTRAL` — the installed NestJS 11.2.3 has no
 * `@SkipVersioncheck()` (global plan G8-R). TODO-02 §5 will exempt this
 * route from the global API-key guard with `@Public()`; until then it is
 * public by default (no guard exists yet).
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK` and an empty body.
   *
   * Call it with curl (`-I` sends a HEAD request and prints the headers):
   *   curl -I http://localhost:3001/health/ping
   */
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void {}
}
