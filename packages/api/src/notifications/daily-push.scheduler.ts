import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { PushService } from './push.service.js';
import { InsightsService } from '../insights/insights.service.js';

/**
 * Digest diário por push (VAPID) — 08:00 de Brasília (11:00 UTC). Regra de ouro: 1 resumo/dia, e
 * SÓ se houver algo relevante (nada de push vazio). No-op sem VAPID. Compõe das sugestões do "Hoje".
 */
@Injectable()
export class DailyPushScheduler {
  private readonly log = new Logger('DailyPushScheduler');

  constructor(
    private readonly scoped: TenantScopedService,
    private readonly push: PushService,
    private readonly insights: InsightsService,
  ) {}

  @Cron('0 11 * * *') // 08:00 BRT
  async run(): Promise<void> {
    if (!this.push.isEnabled()) return;
    const tenants = await this.scoped
      .raw()
      .tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } })
      // Falha ao listar tenants NÃO pode ser silenciosa: o cron viraria no-op sem ninguém saber.
      .catch((e: unknown) => { this.log.error(`Falha ao listar carteiras — digest push PULADO: ${String(e)}`); return [] as { id: string }[]; });
    let sent = 0;
    for (const t of tenants) {
      try {
        const sugg = await this.insights.suggestions(t.id);
        if (sugg.length === 0) continue;
        const due = sugg.filter((s) => s.kind === 'due_soon' || s.kind === 'overdue').length;
        const claims = sugg.filter((s) => s.kind === 'claim').length;
        const support = sugg.filter((s) => s.kind === 'support').length;
        const promises = sugg.filter((s) => s.kind === 'promise').length;
        const cooling = sugg.find((s) => s.kind === 'cooling');
        const parts: string[] = [];
        if (support) parts.push(`${support} pedido${support > 1 ? 's' : ''} de suporte`);
        if (promises) parts.push(`${promises} promessa${promises > 1 ? 's' : ''} a vencer`);
        if (claims) parts.push(`${claims} pagamento${claims > 1 ? 's' : ''} a confirmar`);
        if (due) parts.push(`${due} vencimento${due > 1 ? 's' : ''}`);
        if (cooling && parts.length < 3) parts.push(cooling.title.replace(/^🌡️ Talvez valha um oi para /, 'contato: '));
        if (parts.length === 0) continue;
        sent += await this.push.sendToTenant(t.id, { title: 'Pacific — seu resumo de hoje', body: parts.join(' · '), url: '/dashboard' });
      } catch (e) {
        this.log.warn(`Falha no digest push da carteira ${t.id}: ${String(e)}`);
      }
    }
    if (sent > 0) this.log.log(`Digest diário por push: ${sent} enviado(s).`);
  }
}
