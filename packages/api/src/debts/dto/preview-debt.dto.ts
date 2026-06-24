import { IsNumberString, IsIn, IsDateString, IsOptional } from 'class-validator';

// Entrada da prévia de operação (cálculo proprietário roda no SERVIDOR, não no client).
export class PreviewDebtDto {
  @IsNumberString() principal!: string;
  @IsNumberString() rate!: string;
  @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  @IsOptional() @IsDateString() startDate?: string;
  @IsDateString() dueDate!: string;
}
