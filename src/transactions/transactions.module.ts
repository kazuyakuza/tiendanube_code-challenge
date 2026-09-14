/**
 * Feature module for the transaction orchestration (TODO-06 §Task 3,
 * global plan cycle A).
 *
 * Registers `TransactionsController` — the `POST /v1/transactions` route,
 * versioned to `/v1` by the global `defaultVersion: '1'` — and provides
 * `TransactionsService` to it. Imports the two external-client modules so
 * the service can inject `NumeratorService` (two reserved ids per create)
 * and `JsonServerService` (both writes). The global `ConfigModule`
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. The service stays EXPORTED for future consumers (tests, Cycle-B
 * compensation wiring).
 *
 * Cycle B (TODO-06 §Task 2.2): provides `TransactionCompensationService` and
 * its own timeout-configured `HttpModule.register` instance (T3-D2 precedent)
 * for the orphaned-transaction DELETE retry loop.
 *
 * Security note (G1): no `@UseGuards` here — the global `ApiKeyGuard`
 * (`APP_GUARD` in `app.module.ts`) already protects the controller's
 * non-`@Public` routes with 401 on missing/wrong `x-api-key`.
 *
 * Related: `docs/app-setup.md`; `transactions.controller.ts`.
 */
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HTTP_TIMEOUT_MS } from '../common/constants/http-timeout.constants';
import { JsonServerModule } from '../json-server/json-server.module';
import { NumeratorModule } from '../numerator/numerator.module';
import { TransactionCompensationService } from './transaction-compensation.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [
    NumeratorModule,
    JsonServerModule,
    HttpModule.register({ timeout: HTTP_TIMEOUT_MS }),
  ],
  providers: [TransactionsService, TransactionCompensationService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
