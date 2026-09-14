/**
 * Numerator API client (TODO-04 §Task 1). The upstream mock lives in
 * `numerator-api/api.js` (+ `numerator-api/numerator.js` for state semantics);
 * runbook + curl contract exercises: `docs/app-setup.md` (External clients).
 *
 * Generates unique sequential IDs through the mock's atomic CAS endpoint
 * (`PUT /numerator/test-and-set`) with a bounded retry loop: every attempt
 * re-reads the current value (`GET /numerator`), proposes `current + 1` and
 * test-and-sets it. ONLY a genuine CAS conflict (HTTP 400 whose body carries
 * a numeric `currentNumerator`) is retried, with a light exponential backoff
 * `min(base * 2^retryIndex, MAX_NUMERATOR_BACKOFF_MS)`; every other failure
 * (network, timeout, 5xx, unexpected 400) surfaces immediately as a domain
 * error so callers can abort before writing anything.
 *
 * AI-agent guidance:
 * - IDs are returned as STRINGS (json-server string-id convention, TODO §1.1).
 * - Config reads go through `ConfigService` + `ConfigKeys` only (never
 *   `process.env`); MAX_RETRIES and NUMERATOR_BASE_BACKOFF_MS are optional
 *   with in-code defaults from `numerator.constants.ts` (global plan G1/G2/G3).
 * - Error taxonomy lives in `errors/numerator.errors.ts`; mapping errors to
 *   HTTP responses is NOT this client's job (global plan G18) — since
 *   TODO-06 Cycle B the global `AllExceptionsFilter` maps them to 503.
 * - `MAX_RETRIES` counts TOTAL CAS attempts (not extra retries); the backoff
 *   sleep happens only between attempts (the final conflict does not sleep).
 * - Numerator values are non-sensitive numbers — safe to log (G13). Never log
 *   card data anywhere in this client.
 */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ConfigKeys } from '../config/config.keys';
import {
  InvalidNumeratorValueError,
  NumeratorRetriesExhaustedError,
  NumeratorUnavailableError,
} from './errors/numerator.errors';
import { CasAttemptResult } from './interfaces/cas-attempt-result.interface';
import { CasFailureContext } from './interfaces/cas-failure-context.interface';
import {
  CasConflictResponseBody,
  CasSuccessResponseBody,
  NumeratorCurrentResponseBody,
} from './interfaces/numerator-api.interfaces';
import {
  CAS_CONFLICT_STATUS,
  MAX_NUMERATOR_BACKOFF_MS,
  NUMERATOR_DEFAULT_BASE_BACKOFF_MS,
  NUMERATOR_DEFAULT_MAX_RETRIES,
} from './numerator.constants';

@Injectable()
export class NumeratorService {
  private readonly logger = new Logger(NumeratorService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = configService.getOrThrow<string>(ConfigKeys.NumeratorApiUrl);
  }

  async getNextId(): Promise<string> {
    const maxRetries = this.configService.get<number>(
      ConfigKeys.MaxRetries,
      NUMERATOR_DEFAULT_MAX_RETRIES,
    );
    const reservedId = await this.retryReservation(maxRetries);
    return String(reservedId);
  }

  private async retryReservation(maxRetries: number): Promise<number> {
    let lastKnownCurrent: number | undefined;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptResult = await this.attemptReservation(attempt, maxRetries);
      lastKnownCurrent = attemptResult.observedCurrent;
      if (attemptResult.reservedId !== null) {
        return attemptResult.reservedId;
      }
    }
    throw new NumeratorRetriesExhaustedError(maxRetries, lastKnownCurrent);
  }

  private async attemptReservation(attempt: number, maxRetries: number): Promise<CasAttemptResult> {
    const currentNumerator = await this.getCurrentNumerator();
    const candidate = this.buildCandidate(currentNumerator);
    try {
      await this.testAndSet(currentNumerator, candidate);
      return { reservedId: candidate, observedCurrent: currentNumerator };
    } catch (error) {
      return this.handleTestAndSetFailure({ error, attempt, maxRetries, currentNumerator, candidate });
    }
  }

  private async handleTestAndSetFailure(context: CasFailureContext): Promise<CasAttemptResult> {
    if (!this.isCasConflict(context.error)) {
      throw this.toUnavailableError(context.error);
    }
    this.logConflict(context);
    await this.waitForRetry(context.attempt, context.maxRetries);
    return { reservedId: null, observedCurrent: context.currentNumerator };
  }

  private isCasConflict(error: unknown): boolean {
    if (!isAxiosError<CasConflictResponseBody>(error)) {
      return false;
    }
    return this.isConflictResponse(error.response);
  }

  private isConflictResponse(
    response: AxiosResponse<CasConflictResponseBody> | undefined,
  ): boolean {
    const currentNumerator = response?.data?.currentNumerator;
    return response?.status === CAS_CONFLICT_STATUS && typeof currentNumerator === 'number';
  }

  private toUnavailableError(error: unknown): NumeratorUnavailableError {
    if (error instanceof Error) {
      return new NumeratorUnavailableError(error.message);
    }
    return new NumeratorUnavailableError(String(error));
  }

  private logConflict(context: CasFailureContext): void {
    this.logger.warn(
      `Numerator CAS conflict — attempt ${context.attempt}/${context.maxRetries}, current=${context.currentNumerator}, candidate=${context.candidate}`,
    );
  }

  private async waitForRetry(attempt: number, maxRetries: number): Promise<void> {
    if (attempt >= maxRetries) {
      return;
    }
    await this.sleep(this.computeBackoffDelay(attempt));
  }

  private computeBackoffDelay(attempt: number): number {
    const baseBackoffMs = this.configService.get<number>(
      ConfigKeys.NumeratorBaseBackoffMs,
      NUMERATOR_DEFAULT_BASE_BACKOFF_MS,
    );
    const retryIndex = attempt - 1;
    return Math.min(baseBackoffMs * 2 ** retryIndex, MAX_NUMERATOR_BACKOFF_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getCurrentNumerator(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NumeratorCurrentResponseBody>(`${this.baseUrl}/numerator`),
      );
      return this.extractValidCurrent(response.data);
    } catch (error) {
      throw this.toUnavailableError(error);
    }
  }

  private extractValidCurrent(data: NumeratorCurrentResponseBody): number {
    const rawNumerator = data.numerator;
    if (!isFiniteNumber(rawNumerator)) {
      throw new InvalidNumeratorValueError(rawNumerator);
    }
    return rawNumerator;
  }

  private buildCandidate(currentNumerator: number): number {
    const candidate = currentNumerator + 1;
    if (!Number.isSafeInteger(candidate)) {
      throw new InvalidNumeratorValueError(candidate);
    }
    return candidate;
  }

  private async testAndSet(oldValue: number, newValue: number): Promise<void> {
    const casUrl = `${this.baseUrl}/numerator/test-and-set`;
    await firstValueFrom(
      this.httpService.put<CasSuccessResponseBody>(casUrl, { oldValue, newValue }),
    );
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
