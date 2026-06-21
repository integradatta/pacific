import { IsNumberString, IsOptional, IsBoolean, ValidateIf } from 'class-validator';

// Pagamento: `full: true` quita a dívida; senão `amount` abate parcialmente.
export interface PayDebtInput {
  amount?: string;
  full?: boolean;
}

export class PayDebtDto implements PayDebtInput {
  @IsOptional() @IsBoolean() full?: boolean;
  // amount obrigatório quando não for pagamento total; deve ser numérico.
  @ValidateIf((o: PayDebtDto) => !o.full) @IsNumberString() amount?: string;
}
