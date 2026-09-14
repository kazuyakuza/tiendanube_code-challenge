/**
 * Transaction orchestration service (TODO §Task 1/2; global plan T5-G1).
 *
 * Single public method `create(dto)` turns a valid `CreateTransactionDto`
 * into a persisted transaction + receivable pair, in the strict 9-step flow
 * of TODO §Task 2 (both Numerator ids reserved BEFORE any write).
 *
 * Error behaviour (TODO §Task 5, T5-G8): NO try/catch — failures of
 * `getNextId()` or of either json-server write propagate untouched. A
 * transaction persisted but a receivable that fails leaves a PARTIALLY
 * WRITTEN state; this is accepted at this stage and compensation is next-
 * TODO scope (controller + global error handling). The caller must see the
 * raw failure.
 *
 * Logging (T5-G10): one debug line on success carrying ONLY the two numeric
 * string ids — never the payload (card data) and never amounts.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskCardNumber } from '../common/utils/card-number.util';
import { PAYMENT_FEE_PERCENTAGES } from '../common/constants/payment-fee.constants';
import { ConfigKeys } from '../config/config.keys';
import { NumeratorService } from '../numerator/numerator.service';
import { JsonServerService } from '../json-server/json-server.service';
import {
  CreateReceivablePayload,
} from '../json-server/interfaces/create-receivable-payload.interface';
import {
  CreateTransactionPayload,
} from '../json-server/interfaces/create-transaction-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionResponseDto } from './dto/create-transaction-response.dto';
import {
  formatDateDDMMYYYY,
  computeTotal,
  resolveReceivableStatus,
} from './fee-rules';

interface ReservedIds { transactionId: string; receivableId: string; }

interface BuildTransactionPayloadContext { dto: CreateTransactionDto; transactionId: string; }

interface BuildReceivablePayloadContext {
  dto: CreateTransactionDto;
  receivableId: string;
  transactionId: string;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly numeratorService: NumeratorService,
    private readonly jsonServerService: JsonServerService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateTransactionDto): Promise<CreateTransactionResponseDto | undefined> {
    const ids = await this.reserveIds();
    const transactionResult = await this.jsonServerService.createTransaction(
      this.buildTransactionPayload({ dto, transactionId: ids.transactionId }),
    );
    const receivableResult = await this.jsonServerService.createReceivable(
      this.buildReceivablePayload({ dto, receivableId: ids.receivableId, transactionId: ids.transactionId }),
    );
    this.logger.debug(`transaction ${ids.transactionId} + receivable ${ids.receivableId} created`);
    if (!this.shouldReturnBody()) {
      return undefined;
    }
    const response = new CreateTransactionResponseDto();
    response.transaction = transactionResult;
    response.receivable = receivableResult;
    return response;
  }

  private async reserveIds(): Promise<ReservedIds> {
    const transactionId = await this.numeratorService.getNextId();
    const receivableId = await this.numeratorService.getNextId();
    return { transactionId, receivableId };
  }

  private buildTransactionPayload(context: BuildTransactionPayloadContext): CreateTransactionPayload {
    return {
      id: context.transactionId,
      value: context.dto.value,
      description: context.dto.description,
      method: context.dto.method,
      cardNumber: maskCardNumber(context.dto.cardNumber),
      cardHolderName: context.dto.cardHolderName,
      cardExpirationDate: context.dto.cardExpirationDate,
      cardCvv: context.dto.cardCvv,
    };
  }

  private buildReceivablePayload(context: BuildReceivablePayloadContext): CreateReceivablePayload {
    const discount = PAYMENT_FEE_PERCENTAGES[context.dto.method];
    return {
      id: context.receivableId,
      transaction_id: context.transactionId,
      status: resolveReceivableStatus(context.dto.method),
      create_date: formatDateDDMMYYYY(new Date()),
      subtotal: context.dto.value,
      discount,
      total: computeTotal(context.dto.value, discount),
    };
  }

  private shouldReturnBody(): boolean {
    return this.configService.get<boolean>(ConfigKeys.TransactionsReturnBody, true);
  }
}
