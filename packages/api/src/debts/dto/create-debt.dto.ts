import { IsString, IsOptional, IsIn, IsNumberString, IsDateString, IsArray } from 'class-validator';
import { IsDecimalInRange } from '../../common/decimal-range.validator.js';

// Tetos de sanidade (não política de crédito): bloqueiam typo/abuso, não definem regra de negócio.
export const PRINCIPAL_MAX = 100_000_000; // R$ 100 mi
export const RATE_MAX = 1; // fração por período (1 = 100% a.m./a.a.) — barra "9.9" (=990%)

export interface CreateDebtInput {
  debtorId: string;
  description?: string;
  principal: string;   // valor monetário como string (Decimal)
  rate: string;
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  currency?: string;
  startDate: string;   // ISO
  dueDate: string;     // ISO
  tags?: string[];
}

export class CreateDebtDto implements CreateDebtInput {
  @IsString() debtorId!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumberString() @IsDecimalInRange(0.01, PRINCIPAL_MAX, { message: 'Principal deve ser positivo e realista.' }) principal!: string;
  @IsNumberString() @IsDecimalInRange(0, RATE_MAX, { message: 'Taxa fora da faixa (verifique se digitou % correto).' }) rate!: string;
  @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  @IsOptional() @IsString() currency?: string;
  @IsDateString() startDate!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
