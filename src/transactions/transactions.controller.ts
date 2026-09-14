/**
 * HTTP controller for `POST /v1/transactions` (TODO-06 §Task 1.1–1.3;
 * global plan G1–G3/G6, cycle A).
 *
 * Thin orchestration endpoint (G3): validate → call → return. The body is
 * validated by the global ValidationPipe (`whitelist`/`forbidNonWhitelisted`/
 * `transform` in `src/main.ts`) against `CreateTransactionDto`; invalid
 * payloads answer **400**. The handler returns `TransactionsService.create(dto)`
 * directly — the `TRANSACTIONS_RETURN_BODY` gate lives at the SERVICE level
 * (global plan G2): `true` ⇒ `CreateTransactionResponseDto` envelope, `false`
 * ⇒ `undefined`, which the Express adapter serializes as a bare **201** with
 * an empty body (`@HttpCode(201)` sets the status before the nil-body send —
 * verified in `express-adapter.js reply()`).
 *
 * Security (G1): API-key protection is enforced by the GLOBAL `ApiKeyGuard`
 * registered via `APP_GUARD` in `app.module.ts`. This controller deliberately
 * carries NO `@UseGuards` and NO `@Public()` — every request must send the
 * matching `x-api-key` header (missing/wrong ⇒ **401**). Do not add either
 * decorator; a redundant second enforcement is a plan violation.
 *
 * Error behaviour: domain errors (`NumeratorUnavailableError`,
 * `NumeratorRetriesExhaustedError`, `InvalidNumeratorValueError`,
 * `JsonServerRequestError`) propagate RAW from the service — the documented
 * 502/503 responses are produced once the Cycle-B global exception filter
 * (global plan G4) lands; until then they surface as the NestJS default 500.
 * The Swagger annotations below already document the target contract.
 *
 * Versioning (CA-D1): no `version` metadata — the global `defaultVersion: '1'`
 * (`main.ts` URI versioning) mounts this at `/v1/transactions`. Contrast:
 * `HealthController` opts OUT with `VERSION_NEUTRAL`.
 *
 * Related: `docs/app-setup.md`; global plan
 * `.kilo/plans/20260914-transactions-endpoint.md` (§3 G1–G3, G6).
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionResponseDto } from './dto/create-transaction-response.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Creates one transaction plus its corresponding receivable (TODO-06 §1.1).
   * Returns the `{ transaction, receivable }` envelope, or a bare `201` with
   * an empty body when `TRANSACTIONS_RETURN_BODY=false` (service-level gate,
   * G2). Requires the `x-api-key` header (global `ApiKeyGuard`, G1).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a transaction and its corresponding receivable' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({
    description: 'Transaction and receivable created; body omitted when TRANSACTIONS_RETURN_BODY=false.',
    type: CreateTransactionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Payload failed DTO validation.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid x-api-key header.' })
  @ApiServiceUnavailableResponse({ description: 'Numerator or json-server unreachable (mapping lands with the Cycle-B exception filter).' })
  @ApiBadGatewayResponse({ description: 'json-server returned an unexpected 4xx (mapping lands with the Cycle-B exception filter).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error (mapping lands with the Cycle-B exception filter).' })
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<CreateTransactionResponseDto | undefined> {
    return this.transactionsService.create(createTransactionDto);
  }
}
