import { IsDateString, IsOptional } from 'class-validator';

// Ajuste das datas de uma operação (registrar/corrigir dívidas antigas). Ambos opcionais;
// o serviço valida vencimento >= data inicial e recalcula a gratidão a partir da nova startDate.
export class UpdateDebtDatesDto {
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
