import { IsString, IsOptional, IsIn, IsNumberString, IsDateString, MinLength, IsArray } from 'class-validator';

// Cadastro simplificado: cria cliente (devedor) + operação (dívida) de uma vez.
// rate é a fração do período (ex.: "0.05" = 5%); startDate é "agora" (não vem do form).
export interface CreateQuickDebtInput {
  clientName: string;
  principal: string;
  rate: string;
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  dueDate: string; // ISO
  description?: string;
  tags?: string[];
}

export class CreateQuickDebtDto implements CreateQuickDebtInput {
  @IsString() @MinLength(1) clientName!: string;
  @IsNumberString() principal!: string;
  @IsNumberString() rate!: string;
  @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
