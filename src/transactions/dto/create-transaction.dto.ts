/**
 * Request body of `POST /v1/transactions` (TODO-03 §1).
 *
 * The client sends raw transaction data; the API generates `id` (Numerator,
 * future TODO) and creates the receivable. Every field is required; unknown
 * properties are rejected by the global ValidationPipe
 * (`forbidNonWhitelisted: true` in `src/main.ts`). The card number is
 * accepted in full here — masking to last-4 happens at the service layer
 * (future TODO) via `maskCardNumber` (`src/common/utils/card-number.util.ts`).
 *
 * AI-agent guidance: the TODO-04 controller binds this class as its parsed
 * request body; invalid payloads then answer **400** through the existing
 * global ValidationPipe (`@ApiProperty` metadata feeds Swagger at that
 * moment — neither is rendered today). Wire value invariants encoded below:
 * `method` = `PaymentMethod` strings, all numeric data (`value`,
 * `cardNumber`, `cardCvv`) = strings, `cardExpirationDate` = `MM/YY`
 * end-of-month future validity. Expiration example `"04/28"` is a still
 * FUTURE date — keep every expiration example (here and in the response
 * DTOs) future-dated when refreshing (it fails validation from 2028-05-01).
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { IsFutureExpirationDate } from './validators/is-future-expiration-date.validator';
import { IsPositiveDecimalString } from './validators/is-positive-decimal-string.validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction amount as a decimal string, strictly positive, at most 2 decimal places.',
    example: '250.00',
  })
  @IsString()
  @IsPositiveDecimalString()
  value: string;

  @ApiProperty({
    description: 'Short human-readable description of the purchase.',
    example: 'T-Shirt Black M',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Payment method; decides the fee (2% debit, 4% credit) and the receivable status.',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    description: 'Full card number as received from the client (13–19 digits). Only the last 4 digits are ever stored or returned.',
    example: '4111111111111111',
  })
  @IsString()
  @Matches(/^\d{13,19}$/)
  cardNumber: string;

  @ApiProperty({
    description: 'Cardholder name as printed on the card.',
    example: 'Fonsi Julian',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cardHolderName: string;

  @ApiProperty({
    description: 'Card expiration date in MM/YY format. Must not have expired (valid through the end of the expiration month).',
    example: '04/28',
  })
  @IsString()
  @Matches(/^\d{2}\/\d{2}$/)
  @IsFutureExpirationDate()
  cardExpirationDate: string;

  @ApiProperty({
    description: 'Card verification code, 3 or 4 digits, kept as a string.',
    example: '290',
  })
  @IsString()
  @Matches(/^\d{3,4}$/)
  cardCvv: string;
}
