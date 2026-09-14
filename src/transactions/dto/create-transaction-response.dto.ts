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
