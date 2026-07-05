import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import type { NotificationType } from '@pacific/database';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

export interface WebPushSub { endpoint: string; keys: { p256dh: string; auth: string } }
export interface PushPayload { title: string; body: string; url?: string }

// Eventos do sobrinho que valem um toque no telefone do padrinho (push imediato). Os demais
// (intenção, vencimentos) ficam no app e no resumo diário — push é resumo, não metralhadora.
const IMPORTANT: Partial<Record<NotificationType, (name: string) => PushPayload>> = {
  DEBTOR_FIRST_ACCESS: (n) => ({ title: 'Primeiro acesso', body: `${n} abriu o link pela primeira vez.`, url: '/dashboard' }),
  LOCATION_DECLINED: (n) => ({ title: 'Localização não compartilhada', body: `${n} preferiu não compartilhar a localização.`, url: '/localizacao' }),
  LOCATION_STOPPED: (n) => ({ title: 'Compartilhamento encerrado', body: `${n} parou de compartilhar a localização.`, url: '/localizacao' }),
  LOCATION_SILENT: (n) => ({ title: 'Sobrinho sem sinal', body: `${n} está com a localização ativa, mas sem dar sinal há mais de 48h.`, url: '/localizacao' }),
  PAYMENT_CLAIMED: (n) => ({ title: 'Pagamento avisado', body: `${n} avisou um pagamento — confirme quando puder.`, url: '/dashboard' }),
  DEBTOR_SUPPORT: (n) => ({ title: 'Pedido de suporte', body: `${n} pediu ajuda — que tal dar um alô?`, url: '/dashboard' }),
};

/**
 * Envio de Web Push (VAPID) ao padrinho. NO-OP sem VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (deploy não
 * quebra). Regra de ouro: push é RESUMO, não metralhadora — 1 digest/dia + eventos de mão dupla.
 * Assinaturas inválidas (404/410) são podadas automaticamente.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('PushService');
  private enabled = false;

  constructor(private readonly scoped: TenantScopedService) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      try {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:no-reply@pacific.app', pub, priv);
        this.enabled = true;
      } catch (e) {
        this.log.warn(`VAPID inválido — push desabilitado: ${String(e)}`);
      }
    }
  }

  isEnabled(): boolean { return this.enabled; }

  /** Push imediato de um evento importante do sobrinho. No-op para tipos não-importantes/sem VAPID. */
  async notifyImportant(tenantId: string, type: NotificationType, name: string): Promise<number> {
    const build = IMPORTANT[type];
    if (!build) return 0;
    return this.sendToTenant(tenantId, build(name));
  }

  /** Guarda/atualiza a assinatura do navegador do padrinho (por endpoint). */
  async saveSubscription(tenantId: string, supabaseId: string, sub: WebPushSub): Promise<void> {
    const db = this.scoped.raw();
    await db.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { tenantId, supabaseId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { tenantId, supabaseId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  }

  /** Envia um push para todas as assinaturas do tenant (o padrinho). No-op sem VAPID. */
  async sendToTenant(tenantId: string, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    const db = this.scoped.raw();
    const subs = await db.pushSubscription.findMany({ where: { tenantId } });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined); // assinatura morta; poda best-effort
        } else {
          // Outros erros (429/5xx/rede) NÃO podem ser silenciosos: seria o push degradando sem ninguém saber.
          // Não loga o endpoint completo — é capability URL (quem o tem consegue enviar push).
          this.log.warn(`Falha ao enviar push (tenant ${tenantId}, status ${code ?? '?'}): ${String((e as Error)?.message ?? e)}`);
        }
      }
    }
    return sent;
  }
}
