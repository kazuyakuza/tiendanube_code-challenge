/**
 * Global API-key guard (TODO-02 §5).
 *
 * Behavior (§5.1): every request must carry header `x-api-key` whose value
 * matches the validated `API_KEY` env var exactly; anything else is rejected
 * with **401 Unauthorized**. Routes decorated with `@Public()` (handler or
 * class level) are exempt — that is how `HEAD /health/ping` stays reachable.
 *
 * CRITICAL: rejection THROWS `UnauthorizedException` (401). A guard that
 * merely `return false` produces **403 Forbidden** in NestJS — wrong status.
 * Do not "simplify" the throw into a boolean return.
 *
 * Comparison is a plain exact string compare (global plan G9): constant-time
 * comparison and hashing are explicitly out of scope for this challenge.
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigKeys } from '../../config/config.keys';
import { API_KEY_HEADER } from '../api-key.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) {
      return true;
    }
    return this.isRequestAuthorized(context);
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic === true;
  }

  private isRequestAuthorized(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers[API_KEY_HEADER];
    const expectedKey = this.configService.getOrThrow<string>(ConfigKeys.ApiKey);
    if (!isAuthorizedKey(providedKey, expectedKey)) {
      throw new UnauthorizedException('Missing or invalid x-api-key header');
    }
    return true;
  }
}

/**
 * Exact-match policy: `undefined` fails; duplicate headers (array) match only
 * when the FIRST value equals the expected key; otherwise plain `===`.
 */
function isAuthorizedKey(providedKey: string | string[] | undefined, expectedKey: string): boolean {
  if (Array.isArray(providedKey)) {
    return providedKey[0] === expectedKey;
  }
  return providedKey === expectedKey;
}
