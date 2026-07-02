import { IsString, IsOptional, IsIn, IsNumberString, IsDateString, MinLength, IsArray } from 'class-validator';
import { IsDecimalInRange } from '../../common/decimal-range.validator.js';
import { PRINCIPAL_MAX, RATE_MAX } from './create-debt.dto.js';

// Cadastro simplificado: cria cliente (devedor) + operação (dívida) de uma vez.
// rate é a fração do período (ex.: "0.05" = 5%). startDate é opcional: permite registrar
// dívidas ANTIGAS (data passada); se omitido, assume "agora".
export interface CreateQuickDebtInput {
  clientName: string;
  principal: string;
  rate: string;
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  startDate?: string; // ISO — opcional (dívidas antigas)
  dueDate: string; // ISO
  description?: string;
  tags?: string[];
}

export class CreateQuickDebtDto implements CreateQuickDebtInput {
  @IsString() @MinLength(1) clientName!: string;
  @IsNumberString() @IsDecimalInRange(0.01, PRINCIPAL_MAX, { message: 'Principal deve ser positivo e realista.' }) principal!: string;
  @IsNumberString() @IsDecimalInRange(0, RATE_MAX, { message: 'Taxa fora da faixa (verifique se digitou % correto).' }) rate!: string;
  @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  @IsOptional() @IsDateString() startDate?: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
