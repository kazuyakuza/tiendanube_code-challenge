/**
 * Partial-failure compensation service (TODO-06 §Task 2.2, global plan G5;
 * cycle B).
 *
 * When `TransactionsService.create()` persisted the transaction but the
 * receivable write failed, this class tries to delete the orphaned
 * transaction (`DELETE {JSON_SERVER_URL}/transactions/:id`) with a bounded
 * retry loop — up to `COMPENSATION_MAX_ATTEMPTS` total attempts, sleeping
 * `min(COMPENSATION_BASE_BACKOFF_MS × 2^(attempt−1), COMPENSATION_MAX_BACKOFF_MS)`
 * between them (never after the last). A 404 counts as success (CB-D4a):
 * the row is already gone, so a permanent 404 must not waste the budget.
 *
 * CONTRACT (decision CB-D4/CB-D6): `deleteTransaction` NEVER THROWS. Every
 * failure is caught here and logged; it returns `true` (deleted or already
 * absent) or `false` (still orphaned). This is what lets the orchestration
 * service rethrow the ORIGINAL receivable error without a defensive second
 * try/catch, and guarantees compensation can never mask it (G5/R3).
 *
 * Privacy: logs carry the transaction id, attempt counters and
 * axios-generated reasons ONLY — never payloads, never upstream bodies
 * (T2-D7/G5). The goal is to REDUCE orphans, not eliminate them (§2.2); if
 * all attempts fail the inconsistency is logged and the caller still errors
 * the client. This is a NEW consumer of json-server — `src/json-server/`
 * itself gets ZERO diffs (G7); the resource path is imported from its
 * constants. HttpModule registration lives in TransactionsModule (isolated
 * instance, T3-D2 precedent).
 */
import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  COMPENSATION_BASE_BACKOFF_MS,
  COMPENSATION_MAX_ATTEMPTS,
  COMPENSATION_MAX_BACKOFF_MS,
} from '../common/constants/compensation.constants';
import { ConfigKeys } from '../config/config.keys';
import { TRANSACTIONS_RESOURCE_PATH } from '../json-server/json-server.constants';

/** Param object for a failed DELETE attempt (2-params rule). */
interface CompensationFailureContext {
  transactionId: string;
  attempt: number;
  error: unknown;
}

@Injectable()
export class TransactionCompensationService {
  private readonly logger = new Logger(TransactionCompensationService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.normalizeBaseUrl(
      configService.getOrThrow<string>(ConfigKeys.JsonServerUrl),
    );
  }

  async deleteTransaction(transactionId: string): Promise<boolean> {
    this.logger.warn(`compensation started — deleting orphaned transaction ${transactionId}`);
    for (let attempt = 1; attempt <= COMPENSATION_MAX_ATTEMPTS; attempt++) {
      if (await this.tryDelete(transactionId, attempt)) {
        return true;
      }
    }
    return false;
  }

  private async tryDelete(transactionId: string, attempt: number): Promise<boolean> {
    const resourceUrl = `${this.baseUrl}/${TRANSACTIONS_RESOURCE_PATH}/${transactionId}`;
    try {
      await firstValueFrom(this.httpService.delete(resourceUrl));
      this.logger.warn(
        `compensation succeeded — transaction ${transactionId} deleted (attempt ${attempt})`,
      );
      return true;
    } catch (error) {
      return this.handleDeleteFailure({ transactionId, attempt, error });
    }
  }

  private async handleDeleteFailure(context: CompensationFailureContext): Promise<boolean> {
    if (this.isAlreadyAbsent(context.error)) {
      this.logger.warn(
        `compensation succeeded — transaction ${context.transactionId} already absent (attempt ${context.attempt})`,
      );
      return true;
    }
    const reason = describeError(context.error);
    this.logger.warn(
      `compensation delete failed — transaction ${context.transactionId}, attempt ${context.attempt}/${COMPENSATION_MAX_ATTEMPTS}, reason=${reason}`,
    );
    if (context.attempt >= COMPENSATION_MAX_ATTEMPTS) {
      this.logger.error(
        `compensation exhausted — transaction ${context.transactionId} may remain orphaned, last reason=${reason}`,
      );
      return false;
    }
    await this.sleep(this.computeBackoffDelay(context.attempt));
    return false;
  }

  private isAlreadyAbsent(error: unknown): boolean {
    return isAxiosError(error) && error.response?.status === HttpStatus.NOT_FOUND;
  }

  private normalizeBaseUrl(rawBaseUrl: string): string {
    return rawBaseUrl.replace(/\/+$/, '');
  }

  private computeBackoffDelay(attempt: number): number {
    const retryIndex = attempt - 1;
    return Math.min(
      COMPENSATION_BASE_BACKOFF_MS * 2 ** retryIndex,
      COMPENSATION_MAX_BACKOFF_MS,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
