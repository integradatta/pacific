import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pacific/database';
import type { LivePosition, LocationConsent } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { PingInput } from './dto/ping.dto.js';

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // "online" = posição nos últimos 5 min

type PingRow = {
  debtorId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  battery: number | null;
  recordedAt: Date;
};

@Injectable()
export class LocationService {
  constructor(private readonly scoped: TenantScopedService) {}

  /** Estado de consentimento do próprio devedor (ou visto pelo credor). */
  async getConsent(tenantId: string, debtorId: string): Promise<LocationConsent> {
    return this.scoped.withTenant(tenantId, async (tx) => this.toConsent(await this.debtor(tx, tenantId, debtorId)));
  }

  /**
   * Define o consentimento (opt-in/opt-out VOLUNTÁRIO). granted=true → GRANTED;
   * granted=false → REVOKED (interrompe o compartilhamento; histórico é preservado).
   */
  async setConsent(tenantId: string, debtorId: string, granted: boolean, now: Date = new Date()): Promise<LocationConsent> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.debtor(tx, tenantId, debtorId);
      await tx.debtor.update({
        where: { id: debtorId },
        data: granted
          ? { locationConsent: 'GRANTED', locationConsentAt: now, locationRevokedAt: null }
          : { locationConsent: 'REVOKED', locationRevokedAt: now },
      });
      return this.toConsent(await this.debtor(tx, tenantId, debtorId));
    });
  }

  /**
   * Registra a posição enviada pelo próprio devedor. SÓ aceita com consentimento
   * GRANTED — sem consentimento, recusa (403). Sem rastreamento sem permissão.
   */
  async recordPing(tenantId: string, debtorId: string, input: PingInput, now: Date = new Date()): Promise<LivePosition> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const d = await this.debtor(tx, tenantId, debtorId);
      if (d.locationConsent !== 'GRANTED') {
        throw new ForbiddenException('Compartilhamento de localização não autorizado');
      }
      const ping = await tx.locationPing.create({
        data: {
          tenantId,
          debtorId,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy ?? null,
          battery: input.battery ?? null,
          recordedAt: now,
        },
      });
      return this.toPosition(ping, now);
    });
  }

  /** Última posição conhecida do devedor (null se nunca compartilhou). */
  async lastPosition(tenantId: string, debtorId: string, now: Date = new Date()): Promise<LivePosition | null> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.debtor(tx, tenantId, debtorId);
      const ping = await tx.locationPing.findFirst({ where: { tenantId, debtorId }, orderBy: { recordedAt: 'desc' } });
      return ping ? this.toPosition(ping, now) : null;
    });
  }

  /** Histórico de trajeto (mais recente primeiro), janela opcional [from, to]. */
  async history(
    tenantId: string,
    debtorId: string,
    opts: { from?: Date; to?: Date; limit?: number } = {},
    now: Date = new Date(),
  ): Promise<LivePosition[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.debtor(tx, tenantId, debtorId);
      const recordedAt =
        opts.from || opts.to ? { gte: opts.from ?? undefined, lte: opts.to ?? undefined } : undefined;
      const pings = await tx.locationPing.findMany({
        where: { tenantId, debtorId, ...(recordedAt ? { recordedAt } : {}) },
        orderBy: { recordedAt: 'desc' },
        take: Math.min(Math.max(opts.limit ?? 200, 1), 1000),
      });
      return pings.map((p) => this.toPosition(p, now));
    });
  }

  /**
   * Painel do credor: última posição de CADA devedor que está compartilhando
   * (consentimento GRANTED). Só aparece quem optou por participar.
   */
  async positions(tenantId: string, now: Date = new Date()): Promise<LivePosition[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const sharers = await tx.debtor.findMany({ where: { tenantId, locationConsent: 'GRANTED' }, select: { id: true } });
      const out: LivePosition[] = [];
      for (const s of sharers) {
        const ping = await tx.locationPing.findFirst({ where: { tenantId, debtorId: s.id }, orderBy: { recordedAt: 'desc' } });
        if (ping) out.push(this.toPosition(ping, now));
      }
      return out;
    });
  }

  private toPosition(p: PingRow, now: Date): LivePosition {
    return {
      debtorId: p.debtorId,
      lat: p.lat,
      lng: p.lng,
      recordedAt: p.recordedAt.toISOString(),
      online: now.getTime() - p.recordedAt.getTime() <= ONLINE_WINDOW_MS,
      battery: p.battery,
      accuracy: p.accuracy,
    };
  }

  private toConsent(d: { id: string; locationConsent: string; locationConsentAt: Date | null; locationRevokedAt: Date | null }): LocationConsent {
    return {
      debtorId: d.id,
      state: d.locationConsent as LocationConsent['state'],
      grantedAt: d.locationConsentAt ? d.locationConsentAt.toISOString() : null,
      revokedAt: d.locationRevokedAt ? d.locationRevokedAt.toISOString() : null,
      updatedAt: (d.locationRevokedAt ?? d.locationConsentAt ?? new Date(0)).toISOString(),
    };
  }

  private async debtor(tx: Prisma.TransactionClient, tenantId: string, debtorId: string) {
    const d = await tx.debtor.findFirst({ where: { id: debtorId, tenantId } });
    if (!d) throw new NotFoundException('Devedor não encontrado');
    return d;
  }
}
