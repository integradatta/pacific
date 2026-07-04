import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import { IsDecimalInRange } from '../../common/decimal-range.validator.js';
import { RATE_MAX } from './create-debt.dto.js';

// Renegociação: novo vencimento (obrigatório) e, opcionalmente, nova taxa/período.
export class RenegotiateDebtDto {
  @IsISO8601() dueDate!: string;
  // Taxa em fração decimal (ex.: "0.030000" = 3%) — mesma convenção do create; teto barra typo.
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,6})?$/, { message: 'Taxa inválida' })
  @IsDecimalInRange(0, RATE_MAX, { message: 'Taxa fora da faixa (verifique se digitou % correto).' }) rate?: string;
  @IsOptional() @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod?: 'MONTHLY' | 'ANNUAL';
}
