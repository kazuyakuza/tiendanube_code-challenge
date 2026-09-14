/**
 * Global exception filter (TODO-06 §Task 2.3, global plan G4; cycle B).
 *
 * The single error-mapping surface of the API (G3/G4): every unhandled
 * exception reaches `catch()` and is answered with the structured
 * `{ statusCode, message, error }` JSON body.
 *
 * Dispatch (max depth 2):
 * 1. `HttpException` → re-emitted with its own status and its own response
 *    object (guard 401, ValidationPipe 400 — whose `message` is a string[]
 *    that MUST survive untouched — router 404, any future HttpException).
 * 2. Domain errors from the external clients → §2.1 mapping:
 *    Numerator errors → 503; `JsonServerRequestError` → 503 when the status
 *    is unknown or >= 500, 502 (Bad Gateway) on 4xx. Messages pass through
 *    VERBATIM: they are payload-safe by construction (T2-D7/G8) and already
 *    carry the required detail (e.g. "Numerator ID reservation failed after
 *    N attempts", "json-server request failed — resource=…, status=…").
 * 3. Unknown errors → logged server-side with stack (Logger.error, ALWAYS)
 *    and answered with the generic 500 body in EVERY environment — no stack
 *    or internal detail can ever reach a client, which satisfies the
 *    §2.3 production no-leak rule by construction (decision CB-D3).
 *
 * AI-agent guidance: NO ConfigService/NODE_ENV read here (CB-D3, log-only
 * approach); never log request payloads (card data — TODO privacy rule);
 * mapping domain errors is THIS filter's job — clients never throw HTTP
 * statuses (global plan G18). Registered via APP_FILTER in app.module.ts
 * (the token comes from @nestjs/core, same as APP_GUARD).
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JsonServerRequestError } from '../../json-server/errors/json-server.errors';
import {
  InvalidNumeratorValueError,
  NumeratorRetriesExhaustedError,
  NumeratorUnavailableError,
} from '../../numerator/errors/numerator.errors';

/** HTTP reason phrases for every status this filter can emit. */
const HTTP_STATUS_PHRASES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

/** Structured error body of §2.3. */
interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
}

/** Generic 500 body sent for unknown errors in every environment (CB-D3). */
const INTERNAL_ERROR_BODY: ErrorResponseBody = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'Internal server error',
  error: 'Internal Server Error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(this.toHttpExceptionBody(exception));
      return;
    }
    const domainBody = this.resolveDomainBody(exception);
    if (domainBody !== undefined) {
      response.status(domainBody.statusCode).json(domainBody);
      return;
    }
    this.logUnknown(exception);
    response.status(INTERNAL_ERROR_BODY.statusCode).json(INTERNAL_ERROR_BODY);
  }

  private toHttpExceptionBody(exception: HttpException): object {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return {
        statusCode: exception.getStatus(),
        message: payload,
        error: HTTP_STATUS_PHRASES[exception.getStatus()],
      };
    }
    return payload;
  }

  private resolveDomainBody(exception: unknown): ErrorResponseBody | undefined {
    if (
      exception instanceof NumeratorUnavailableError ||
      exception instanceof NumeratorRetriesExhaustedError ||
      exception instanceof InvalidNumeratorValueError
    ) {
      return this.buildBody(HttpStatus.SERVICE_UNAVAILABLE, exception.message);
    }
    if (exception instanceof JsonServerRequestError) {
      return this.buildBody(this.mapJsonServerStatus(exception.status), exception.message);
    }
    return undefined;
  }

  private mapJsonServerStatus(status: number | undefined): number {
    if (status === undefined || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.BAD_GATEWAY;
  }

  private buildBody(statusCode: number, message: string): ErrorResponseBody {
    return { statusCode, message, error: HTTP_STATUS_PHRASES[statusCode] };
  }

  private logUnknown(exception: unknown): void {
    const detail = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`Unhandled exception: ${detail}`);
  }
}
