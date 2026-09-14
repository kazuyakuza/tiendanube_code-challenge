/**
 * Payment fee percentages per method (TODO-03 §3, brief §3.2 USER DECISION).
 *
 * `discount` is stored/persisted as the fee PERCENTAGE as a string
 * (debit_card → "2", credit_card → "4"), NOT as a fee amount. The later
 * business-logic TODO computes `total = subtotal × (1 − discount/100)`.
 */
import { PaymentMethod } from '../enums/payment-method.enum';

export const PAYMENT_FEE_PERCENTAGES: Readonly<Record<PaymentMethod, string>> = {
  [PaymentMethod.DEBIT_CARD]: '2',
  [PaymentMethod.CREDIT_CARD]: '4',
};
