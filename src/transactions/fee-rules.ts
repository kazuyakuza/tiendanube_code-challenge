/**
 * Pure fee/date business rules for the transaction orchestration
 * (TODO §Task 3, global plan T5-G2). No NestJS imports — plain functions
 * designed for later unit testing.
 *
 * Payment-method rules (brief §3.2):
 * - debit_card  → fee "2", receivable status `paid`  (settles D+0)
 * - credit_card → fee "4", receivable status `waiting_funds` (settles D+30)
 *
 * The fee PERCENTAGES themselves are NOT declared here — the service looks
 * them up in PAYMENT_FEE_PERCENTAGES
 * (`src/common/constants/payment-fee.constants.ts`) and passes the percent
 * string into `computeTotal`; never re-declare "2"/"4" in this file.
 *
 * USER RULING (Option B, 2026-09-14): there is NO payment_date field and NO
 * future-date computation anywhere — D+0/D+30 timing is expressed ONLY via
 * `status`. Do not add add-days code here (it would be dead code).
 *
 * Related: sole consumer `./transactions.service.ts`; guide
 * `docs/app-setup.md` → "Transactions orchestration service (TODO-05)".
 */
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { ReceivableStatus } from '../common/enums/receivable-status.enum';

/** 2-decimal wire format: always exactly two fractional digits. */
const DECIMAL_SCALE = 100;
const DECIMAL_PLACES = 2;

export function resolveReceivableStatus(method: PaymentMethod): ReceivableStatus {
  return method === PaymentMethod.DEBIT_CARD
    ? ReceivableStatus.PAID
    : ReceivableStatus.WAITING_FUNDS;
}

export function computeTotal(subtotal: string, discountPercent: string): string {
  const subtotalCents = parseCents(subtotal);
  const remainingPercent = DECIMAL_SCALE - Number(discountPercent);
  const totalCents = Math.floor((subtotalCents * remainingPercent) / DECIMAL_SCALE);
  return formatCents(totalCents);
}

export function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(DECIMAL_PLACES, '0');
  const month = String(date.getMonth() + 1).padStart(DECIMAL_PLACES, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function parseCents(value: string): number {
  const cents = Math.round(parseFloat(value) * DECIMAL_SCALE);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`subtotal cents value is not a safe integer: ${value}`);
  }
  return cents;
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const whole = Math.floor(absCents / DECIMAL_SCALE);
  const fraction = absCents % DECIMAL_SCALE;
  return `${sign}${whole}.${String(fraction).padStart(DECIMAL_PLACES, '0')}`;
}
