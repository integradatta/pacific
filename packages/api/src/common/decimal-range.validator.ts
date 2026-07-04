import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Valida que um valor decimal (string ou número) está em [min, max]. Complementa @IsNumberString,
 * que sozinho aceita negativos e absurdos (ex.: principal "-500", rate "9.9" = 990% a.m.).
 */
export function IsDecimalInRange(min: number, max: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDecimalInRange',
      target: object.constructor,
      propertyName,
      constraints: [min, max],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string' && typeof value !== 'number') return false;
          const n = Number(value);
          const [lo, hi] = args.constraints as [number, number];
          return Number.isFinite(n) && n >= lo && n <= hi;
        },
        defaultMessage(args: ValidationArguments): string {
          const [lo, hi] = args.constraints as [number, number];
          return `${args.property} deve ser um número entre ${lo} e ${hi}.`;
        },
      },
    });
  };
}
