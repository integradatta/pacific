import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

/**
 * Hoje devolve o único datasource. No futuro, pode mapear tenants específicos
 * para clients/bancos dedicados sem alterar os serviços que consomem dados.
 */
@Injectable()
export class TenantDatasourceResolver {
  constructor(private readonly prisma: PrismaService) {}
  forTenant(_tenantId: string): PrismaService { return this.prisma; }
}
