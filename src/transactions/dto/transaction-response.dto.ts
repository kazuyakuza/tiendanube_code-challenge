/**
 * Transaction resource as stored in json-server and returned by
 * `POST /v1/transactions` (TODO-03 §2.1). Output-only: no class-validator
 * decorators — validation applies to incoming data only.
 *
 * `cardNumber` is ALWAYS the masked form (last 4 digits); `cardCvv` is
 * returned as received (challenge sample keeps it — TODO §2.1 note).
 *
 * AI-agent guidance: `TransactionsService.create` nests the echoed
 * transaction body in `CreateTransactionResponseDto.transaction` since
 * TODO-05; Swagger renders it only once the (still pending) controller
 * TODO exists — today `/docs` still lists just the health probe.
 * Wire value invariants: every money/id/card field is a string and
 * `cardNumber` carries the 4-digit `maskCardNumber` output, never a PAN.
 */
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Unique transaction id generated via the Numerator API (string per json-server convention).',
    example: '4',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction amount as received in the request.',
    example: '250.00',
  })
  value: string;

  @ApiProperty({
    description: 'Purchase description as received in the request.',
    example: 'T-Shirt Black M',
  })
  description: string;

  @ApiProperty({
    description: 'Payment method used for the transaction.',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD,
  })
  method: PaymentMethod;

  @ApiProperty({
    description: 'Masked card number: only the last 4 digits are stored or returned.',
    example: '1111',
  })
  cardNumber: string;

  @ApiProperty({
    description: 'Cardholder name as received in the request.',
    example: 'Fonsi Julian',
  })
  cardHolderName: string;

  @ApiProperty({
    description: 'Card expiration date in MM/YY format.',
    example: '04/28',
  })
  cardExpirationDate: string;

  @ApiProperty({
    description: 'Card verification code as received in the request.',
    example: '290',
  })
  cardCvv: string;
}
