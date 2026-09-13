/**
 * Marks a route (method or controller) as public, exempting it from the global
 * `ApiKeyGuard` (TODO-02 §5.2, global plan G8/G9).
 *
 * The guard reads this metadata with
 * `Reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`, so a
 * method-level `@Public()` wins over a class-level one. Currently applied at
 * method level on `HealthController.ping()`.
 */
import { SetMetadata } from '@nestjs/common';

/** Metadata key shared between this decorator and `ApiKeyGuard`. No magic strings. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Exempts the decorated route from the global API-key guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
