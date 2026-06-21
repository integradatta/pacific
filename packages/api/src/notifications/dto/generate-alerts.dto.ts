import { IsArray, IsIn, IsOptional } from 'class-validator';

// Réguas de alerta automático (mais próximas do vencimento primeiro).
export const ALERT_TYPES = ['DUE_15', 'DUE_7', 'DUE_3', 'DUE_TODAY', 'OVERDUE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export class GenerateAlertsDto {
  // Quais réguas gerar. Ausente = todas (o painel do credor envia só as ativas).
  @IsOptional() @IsArray() @IsIn(ALERT_TYPES, { each: true })
  types?: AlertType[];
}
