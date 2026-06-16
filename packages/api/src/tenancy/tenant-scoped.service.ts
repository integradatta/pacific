import { Injectable } from '@nestjs/common';
import { TenantDatasourceResolver } from './tenant-datasource.resolver.js';
import type { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class TenantScopedService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}
  db(tenantId: string): PrismaService { return this.resolver.forTenant(tenantId); }
  /** Garante o filtro de tenant em qualquer where. */
  scope<T extends object>(tenantId: string, where: T): T & { tenantId: string } {
    return { ...where, tenantId };
  }
}
