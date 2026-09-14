/**
 * Envelope response of `POST /v1/transactions` (TODO-03 §2): both created
 * resources in one consistent body. Output-only: no class-validator
 * decorators.
 *
 * Gated by env `TRANSACTIONS_RETURN_BODY` (default `true`; see
 * `src/config/env.validation.ts` and `ConfigKeys.TransactionsReturnBody`):
 * when the flag is `false` the endpoint answers a bare `201 CREATED` and
 * this body is not produced. The runtime consumer (controller) arrives with
 * the TODO-04 orchestration work.
 *
 * AI-agent guidance: TODO-04 annotates the controller `201` schema with this
 * class; until then Swagger `/docs` shows only the health probe. Invariants:
 * exactly two resources — masked-`cardNumber` transaction + snake_case
 * receivable, all amounts as strings (see the nested classes' headers).
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
