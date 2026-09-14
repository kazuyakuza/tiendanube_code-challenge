/**
 * Envelope response of `POST /v1/transactions` (TODO-03 §2): both created
 * resources in one consistent body. Output-only: no class-validator
 * decorators.
 *
 * Gated by env `TRANSACTIONS_RETURN_BODY` (default `true`; see
 * `src/config/env.validation.ts` and `ConfigKeys.TransactionsReturnBody`):
 * when the flag is `false` the endpoint answers a bare `201 CREATED` and
 * this body is not produced. Wired since TODO-05 at the SERVICE layer:
 * `TransactionsService.create` returns this envelope (built from the
 * echoed persisted bodies) or `undefined` when the gate is off; since
 * TODO-06 Cycle A `TransactionsController` relays that result directly,
 * so the route-level bare `201` (nil body + `@HttpCode(201)`) is live.
 *
 * AI-agent guidance: `TransactionsController` annotates its `201`
 * response with this class (`@ApiCreatedResponse`), so Swagger `/docs`
 * renders the operation on `POST /v1/transactions`.
 * Invariants: exactly two resources — masked-`cardNumber`
 * transaction + snake_case receivable, all amounts as strings (see the
 * nested classes' headers).
 */
import { ApiProperty } from '@nestjs/swagger';
import { ReceivableResponseDto } from './receivable-response.dto';
import { TransactionResponseDto } from './transaction-response.dto';

export class CreateTransactionResponseDto {
  @ApiProperty({
    description: 'The created transaction resource.',
    type: TransactionResponseDto,
  })
  transaction: TransactionResponseDto;

  @ApiProperty({
    description: 'The receivable created from the transaction.',
    type: ReceivableResponseDto,
  })
  receivable: ReceivableResponseDto;
}
