/**
 * Custom validator: `MM/YY` card expiration date that has not expired
 * (TODO-03 §1.3, global plan G5).
 *
 * End-of-month semantics: the card is valid through the LAST DAY of the
 * expiration month, so the check is a timezone-free UTC calendar comparison
 * `expiration (month, year) >= current (month, year)`. `"04/28"` is valid
 * through 30 Apr 2028. Impossible months (`"13/28"`, `"00/28"`) are rejected.
 */
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const MM_YY_PATTERN = /^(\d{2})\/(\d{2})$/;
const MONTHS_IN_YEAR = 12;
const TWO_DIGIT_YEAR_BASE = 2000;

interface ParsedExpirationDate {
  expirationMonth: number;
  expirationYear: number;
}

@ValidatorConstraint({ name: 'IsFutureExpirationDate', async: false })
export class IsFutureExpirationDateConstraint implements ValidatorConstraintInterface {
  validate(rawValue: unknown): boolean {
    if (typeof rawValue !== 'string') {
      return false;
    }
    return isNotExpiredExpirationDate(rawValue);
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must be a valid MM/YY date that has not expired (e.g. "04/28")`;
  }
}

function isNotExpiredExpirationDate(rawExpirationDate: string): boolean {
  const parsedDate = parseExpirationDate(rawExpirationDate);
  if (parsedDate === null) {
    return false;
  }
  return isCurrentOrFutureMonth(parsedDate.expirationMonth, parsedDate.expirationYear);
}

function parseExpirationDate(rawExpirationDate: string): ParsedExpirationDate | null {
  const matchResult = MM_YY_PATTERN.exec(rawExpirationDate);
  if (matchResult === null) {
    return null;
  }
  const expirationMonth = Number.parseInt(matchResult[1], 10);
  if (!isValidCalendarMonth(expirationMonth)) {
    return null;
  }
  const expirationYear = TWO_DIGIT_YEAR_BASE + Number.parseInt(matchResult[2], 10);
  return { expirationMonth, expirationYear };
}

function isValidCalendarMonth(expirationMonth: number): boolean {
  return expirationMonth >= 1 && expirationMonth <= MONTHS_IN_YEAR;
}

function isCurrentOrFutureMonth(expirationMonth: number, expirationYear: number): boolean {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (expirationYear !== currentYear) {
    return expirationYear > currentYear;
  }
  return expirationMonth >= currentMonth;
}

export function IsFutureExpirationDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureExpirationDateConstraint,
    });
  };
}
