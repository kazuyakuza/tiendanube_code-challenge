/**
 * Custom validator: positive decimal string (TODO-03 §1.3, global plan G5).
 *
 * Accepts `"250.00"`, `"100"`, `"0.5"`; rejects `"0"`, `"0.00"`, `"-5"`,
 * `"abc"`, `""`, `"1.234"` (more than 2 decimal places). Regex anchors the
 * whole string, so embedded whitespace or sign characters fail the match.
 *
 * AI-agent guidance: wire value invariant — `value` travels as a STRING;
 * applied to `CreateTransactionDto.value` today, reachable through HTTP
 * only once the TODO-04 controller binds that DTO. Exact error semantics are
 * on `IsPositiveDecimalStringConstraint` below.
 */
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const POSITIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

@ValidatorConstraint({ name: 'IsPositiveDecimalString', async: false })
export class IsPositiveDecimalStringConstraint implements ValidatorConstraintInterface {
  /** Accepts a strictly positive decimal string (≤ 2 decimals); rejects anything else, including non-strings. */
  validate(rawValue: unknown): boolean {
    if (typeof rawValue !== 'string') {
      return false;
    }
    return isStrictlyPositiveDecimal(rawValue);
  }

  /**
   * Rejection message (no i18n key — the literal text is the message):
   * `<property> must be a positive decimal string with at most 2 decimal
   * places (e.g. "250.00"); zero and negatives are not allowed`.
   * @param validationArguments class-validator context; supplies the property name.
   * @returns the message string shown in the 400 `message[]` once the route exists (TODO-04).
   */
  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must be a positive decimal string with at most 2 decimal places (e.g. "250.00"); zero and negatives are not allowed`;
  }
}

function isStrictlyPositiveDecimal(rawValue: string): boolean {
  if (!POSITIVE_DECIMAL_PATTERN.test(rawValue)) {
    return false;
  }
  return Number.parseFloat(rawValue) > 0;
}

/**
 * Property decorator applying {@link IsPositiveDecimalStringConstraint}.
 * @param validationOptions class-validator overrides passed to `registerDecorator`.
 * @returns a property decorator; usage example: `@IsPositiveDecimalString()`
 * on `CreateTransactionDto.value`.
 */
export function IsPositiveDecimalString(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalStringConstraint,
    });
  };
}
