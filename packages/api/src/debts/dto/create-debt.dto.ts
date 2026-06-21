import { IsString, IsOptional, IsIn, IsNumberString, IsDateString, IsArray } from 'class-validator';

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
  @IsNumberString() principal!: string;
  @IsNumberString() rate!: string;
  @IsIn(['MONTHLY', 'ANNUAL']) ratePeriod: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';
  @IsOptional() @IsString() currency?: string;
  @IsDateString() startDate!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
