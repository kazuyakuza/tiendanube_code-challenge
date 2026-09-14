/**
 * Public liveness probe (TODO-02 §4).
 *
 * An unversioned, key-free endpoint answering `200 OK` with an empty body.
 * Unversioned via `VERSION_NEUTRAL` — the installed NestJS 11.2.3 has no
 * `@SkipVersioncheck()` (global plan G8-R).
 *
 * Explicitly exempted from the global `ApiKeyGuard` (TODO-02 §5, T5) via
 * method-level `@Public()` on `ping()`: the guard is registered globally via
 * `APP_GUARD`, so without the decorator this route would demand an API key.
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK`, no API key required (`@Public()`).
   *
   * Call it with curl (`-I` sends a HEAD request and prints the headers):
   *   curl -I http://localhost:30001/health/ping
   */
  @Public()
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void { }
}
