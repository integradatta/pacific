import { IsNumberString, IsOptional } from 'class-validator';

// Confirmação de pagamento avisado, opcionalmente COM AJUSTE (ex.: avisou 500, caiu 480).
export class ConfirmClaimDto {
  @IsOptional() @IsNumberString() amount?: string;
}
