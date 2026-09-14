/**
 * Custom validator: positive decimal string (TODO-03 §1.3, global plan G5).
 *
 * Accepts `"250.00"`, `"100"`, `"0.5"`; rejects `"0"`, `"0.00"`, `"-5"`,
 * `"abc"`, `""`, `"1.234"` (more than 2 decimal places). Regex anchors the
 * whole string, so embedded whitespace or sign characters fail the match.
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
  validate(rawValue: unknown): boolean {
    if (typeof rawValue !== 'string') {
      return false;
    }
    return isStrictlyPositiveDecimal(rawValue);
  }

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

export function IsPositiveDecimalString(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalStringConstraint,
    });
  };
}
