import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

// Renegociação: novo vencimento (obrigatório) e, opcionalmente, nova taxa/período.
export class RenegotiateDebtDto {
  @IsISO8601() dueDate!: string;
  // Taxa em fração decimal (ex.: "0.030000" = 3%) — mesma convenção do create.
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,6})?$/, { message: 'Taxa inválida' }) rate?: string;
  @IsOptional() @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod?: 'MONTHLY' | 'ANNUAL';
}
