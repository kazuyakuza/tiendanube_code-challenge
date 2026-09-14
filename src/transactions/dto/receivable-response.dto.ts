/**
 * Receivable resource as stored in json-server and returned by
 * `POST /v1/transactions` (TODO-03 §2.2). Output-only: no class-validator
 * decorators. Field names keep the json-server wire format
 * (`transaction_id`, `create_date`, snake_case).
 *
 * Fee rules (brief §3.2 USER DECISION): `discount` is the fee PERCENTAGE as
 * a string ("2" debit / "4" credit); `total = subtotal × (1 − discount/100)`.
 */
import { ApiProperty } from '@nestjs/swagger';
import { ReceivableStatus } from '../../common/enums/receivable-status.enum';

export class ReceivableResponseDto {
  @ApiProperty({
    description: 'Unique receivable id generated via the Numerator API (string per json-server convention).',
    example: '5',
  })
  id: string;

  @ApiProperty({
    description: 'Id of the transaction that originated this receivable.',
    example: '4',
  })
  transaction_id: string;

  @ApiProperty({
    description: 'paid for debit_card (settles D+0); waiting_funds for credit_card (settles 30 days later).',
    enum: ReceivableStatus,
    example: ReceivableStatus.WAITING_FUNDS,
  })
  status: ReceivableStatus;

  @ApiProperty({
    description: 'Receivable creation date. Documented as ISO-8601; note the json-server seed uses DD/MM/YYYY (known discrepancy — business TODO decides the final format).',
    example: '2026-09-13T12:00:00.000Z',
  })
  create_date: string;

  @ApiProperty({
    description: 'Subtotal: same value as the originating transaction.',
    example: '250.00',
  })
  subtotal: string;

  @ApiProperty({
    description: 'Fee percentage as a string: "2" (debit_card) or "4" (credit_card).',
    example: '4',
  })
  discount: string;

  @ApiProperty({
    description: 'Net amount: subtotal × (1 − discount/100), formatted as a string.',
    example: '240.00',
  })
  total: string;
}
