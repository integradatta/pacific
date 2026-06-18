import { Injectable } from '@nestjs/common';
import type { Prisma } from '@pacific/database';
import { TenantDatasourceResolver } from './tenant-datasource.resolver.js';
import type { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class TenantScopedService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}

  /** Cliente base, sem contexto de tenant — para lookups globais/provisionamento. */
  raw(): PrismaService {
    return this.resolver.forTenant('__global__');
  }

  /**
   * Executa fn dentro de uma transação com `app.current_tenant` definido (set_config
   * local), de modo que as policies de RLS isolem por tenant nesta conexão. Toda leitura
   * e escrita tenant-scoped deve passar por aqui — é o que ativa a RLS de fato.
   */
  async withTenant<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const db = this.resolver.forTenant(tenantId);
    return db.$transaction(async (tx) => {
      // set_config(..., true) = escopo de transação (equivale a SET LOCAL), parametrizado.
      await tx.$queryRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  /** Garante o filtro de tenant em qualquer where. */
  scope<T extends object>(tenantId: string, where: T): T & { tenantId: string } {
    return { ...where, tenantId };
  }
}
