import { Injectable } from '@nestjs/common';
import type { Prisma } from '@pacific/database';
import type { ActorType, AdminEventRow, PlatformEventType } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

export interface TrackInput {
  tenantId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  type: PlatformEventType;
  targetType?: string | null;
  targetId?: string | null;
  detail?: unknown;
  ip?: string | null;
}

// Camada de tracking — grava o log unificado (PlatformEvent, global/sem RLS). `record` usa a
// transação do caller (dentro de withTenant); `recordRaw` abre conexão própria (endpoints fora
// de tenant). Nunca lança: tracking não deve derrubar a operação principal.
@Injectable()
export class TrackingService {
  constructor(private readonly scoped: TenantScopedService) {}

  async record(tx: Prisma.TransactionClient, input: TrackInput): Promise<void> {
    try {
      await tx.platformEvent.create({ data: this.toData(input) });
    } catch {
      /* best-effort */
    }
  }

  async recordRaw(input: TrackInput): Promise<void> {
    try {
      await this.scoped.raw().platformEvent.create({ data: this.toData(input) });
    } catch {
      /* best-effort */
    }
  }

  /** Feed para o super-admin (cross-tenant). Filtros opcionais. */
  async list(filters: { tenantId?: string; type?: PlatformEventType; actorType?: ActorType; from?: string; to?: string; limit?: number } = {}): Promise<AdminEventRow[]> {
    const at = filters.from || filters.to ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } : undefined;
    const rows = await this.scoped.raw().platformEvent.findMany({
      where: {
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.actorType ? { actorType: filters.actorType } : {}),
        ...(at ? { at } : {}),
      },
      orderBy: { at: 'desc' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map((e) => ({
      id: e.id,
      tenantId: e.tenantId,
      actorType: e.actorType as ActorType,
      actorId: e.actorId,
      type: e.type as PlatformEventType,
      targetType: e.targetType,
      targetId: e.targetId,
      detail: e.detail,
      at: e.at.toISOString(),
    }));
  }

  private toData(i: TrackInput) {
    return {
      tenantId: i.tenantId ?? null,
      actorType: i.actorType,
      actorId: i.actorId ?? null,
      type: i.type,
      targetType: i.targetType ?? null,
      targetId: i.targetId ?? null,
      detail: (i.detail ?? undefined) as object | undefined,
      ip: i.ip ?? null,
    };
  }
}
