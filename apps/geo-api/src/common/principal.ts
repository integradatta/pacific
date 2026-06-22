import { type RuleResult } from '@pacific/geo-shared';
import { HttpException } from '@nestjs/common';

/** Identidade extraída do JWT da plataforma principal (claims sub/tenant_id/roles). */
export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
}

export interface RequestWithPrincipal {
  principal?: Principal;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
}

/** Converte o resultado de uma regra do geo-shared em exceção HTTP do Nest. */
export function enforce(result: RuleResult): void {
  if (!result.allowed) throw new HttpException(result.message, result.status);
}
