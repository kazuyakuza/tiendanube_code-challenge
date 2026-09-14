/**
 * Feature module for the transaction orchestration (TODO §Module wiring,
 * global plan T5-G1).
 *
 * Imports the two external-client modules so `TransactionsService` can
 * inject `NumeratorService` (two reserved ids per create) and
 * `JsonServerService` (both writes). The global `ConfigModule`
 * (`isGlobal: true`) needs no re-import for the `TRANSACTIONS_RETURN_BODY`
 * read. `TransactionsService` is EXPORTED so the future controller module
 * (next TODO) can consume it; NO controller exists yet — no route points at
 * this module.
 *
 * Related: `docs/app-setup.md` → "Transactions orchestration service
 * (TODO-05)".
 */
import { Module } from '@nestjs/common';
import { JsonServerModule } from '../json-server/json-server.module';
import { NumeratorModule } from '../numerator/numerator.module';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [NumeratorModule, JsonServerModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
