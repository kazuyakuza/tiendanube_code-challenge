/**
 * Payment fee percentages per method (TODO-03 §3, brief §3.2 USER DECISION).
 *
 * `discount` is stored/persisted as the fee PERCENTAGE as a string
 * (debit_card → "2", credit_card → "4"), NOT as a fee amount. `total =
 * subtotal × (1 − discount/100)` is computed by `computeTotal`
 * (`src/transactions/fee-rules.ts`, TODO-05).
 *
 * AI-agent guidance: wire value invariant — every money-ish field on this
 * API (`value`, `subtotal`, `discount`, `total`) is a decimal/percentage
 * STRING, never a JSON number. CONSUMED since TODO-05:
 * `TransactionsService.buildReceivablePayload` looks the fee up here (no
 * specs yet — tests are deferred to a later testing TODO); never
 * re-declare the 2% / 4% numbers.
 */
import { PaymentMethod } from '../enums/payment-method.enum';

export const PAYMENT_FEE_PERCENTAGES: Readonly<Record<PaymentMethod, string>> = {
  [PaymentMethod.DEBIT_CARD]: '2',
  [PaymentMethod.CREDIT_CARD]: '4',
};
