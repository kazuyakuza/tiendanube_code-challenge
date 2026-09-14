/**
 * json-server persistence client (TODO-04 §Task 2). Upstream: the provided
 * json-server container serving `config/db.json` on port 8080
 * (`docker-compose.yml`); guide: `docs/json-server-client.md` (linked from
 * `docs/app-setup.md`, "External clients (TODO-04)").
 *
 * Transport-only: POSTs caller-built payloads to the `transactions` and
 * `receivables` collections and returns the echoed resource body. This client
 * does NOT calculate fees, mask card numbers, generate ids, or default any
 * field — the caller supplies ids (from Numerator) and every payload field
 * verbatim (TODO §2.4). Fail-fast: any 4xx/5xx, network or timeout failure is
 * wrapped as `JsonServerRequestError` (resource + status + reason) with NO
 * retries — the retry policy is explicitly out of scope (TODO §Out of scope).
 *
 * AI-agent guidance:
 * - Base URL comes from `ConfigService.getOrThrow(ConfigKeys.JsonServerUrl)`
 *   (env `JSON_SERVER_URL`, validated at bootstrap); never `process.env`.
 * - Trailing slashes in the configured base URL are stripped once at
 *   construction so resource URLs never double-slash (decision T2-D1).
 * - NEVER log request payloads: they carry card data (TODO §Configuration &
 *   resilience). The only log line is a failure warning with resource + HTTP
 *   status; the error reason is axios-generated text, never the upstream body.
 * - Success = any resolved response (json-server answers 201 on create); the
 *   status is NOT asserted — the echoed body is returned as-is (decision
 *   T2-D3).
 * - Response DTOs are imported TYPE-ONLY (global plan G11): no runtime
 *   dependency on the transactions DTO module exists here.
 * - The module file registers the service minimally; HttpModule timeout
 *   config and AppModule wiring belong to TODO-04 Task 3 (global plan
 *   G12/G14, decision T1-D7: `HttpModule.register`, no `forRoot` in v4).
 */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ConfigKeys } from '../config/config.keys';
import { JsonServerRequestError } from './errors/json-server.errors';
import {
  RECEIVABLES_RESOURCE_PATH,
  TRANSACTIONS_RESOURCE_PATH,
} from './json-server.constants';
import type { JsonServerErrorContext } from './interfaces/json-server-error-context.interface';
import type { CreateTransactionPayload } from './interfaces/create-transaction-payload.interface';
import type { CreateReceivablePayload } from './interfaces/create-receivable-payload.interface';
import type { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import type { ReceivableResponseDto } from '../transactions/dto/receivable-response.dto';

@Injectable()
export class JsonServerService {
  private readonly logger = new Logger(JsonServerService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.normalizeBaseUrl(configService.getOrThrow<string>(ConfigKeys.JsonServerUrl));
  }

  async createTransaction(payload: CreateTransactionPayload): Promise<TransactionResponseDto> {
    return this.postResource<TransactionResponseDto, CreateTransactionPayload>(
      TRANSACTIONS_RESOURCE_PATH,
      payload,
    );
  }

  async createReceivable(payload: CreateReceivablePayload): Promise<ReceivableResponseDto> {
    return this.postResource<ReceivableResponseDto, CreateReceivablePayload>(
      RECEIVABLES_RESOURCE_PATH,
      payload,
    );
  }

  private async postResource<TResponse, TPayload>(
    resourcePath: string,
    payload: TPayload,
  ): Promise<TResponse> {
    const resourceUrl = `${this.baseUrl}/${resourcePath}`;
    try {
      const response = await firstValueFrom(
        this.httpService.post<TResponse, TPayload>(resourceUrl, payload),
      );
      return response.data;
    } catch (error) {
      throw this.toRequestError({ resource: resourcePath, error });
    }
  }

  private toRequestError(context: JsonServerErrorContext): JsonServerRequestError {
    const status = this.extractStatus(context.error);
    this.logger.warn(`json-server ${context.resource} request failed (${describeStatus(status)})`);
    return new JsonServerRequestError({
      resource: context.resource,
      status,
      reason: this.extractReason(context.error),
    });
  }

  private normalizeBaseUrl(rawBaseUrl: string): string {
    return rawBaseUrl.replace(/\/+$/, '');
  }

  private extractStatus(error: unknown): number | undefined {
    if (!isAxiosError(error)) {
      return undefined;
    }
    return error.response?.status;
  }

  private extractReason(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

function describeStatus(status: number | undefined): string {
  return status === undefined ? 'no HTTP status' : `HTTP ${status}`;
}
