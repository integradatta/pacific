// Perfil comportamental do sobrinho (#2) — derivado SÓ de dados já coletados (quitações, claims,
// logins). Função pura e isomórfica (testável). Inclui o "melhor momento para lembrar" (#6).
// Saída pensada para UI mobile: poucos números + UMA frase legível (nada de excesso).

export type Reliability = 'reliable' | 'usually_late' | 'unpredictable' | 'unknown';
export type Trend = 'up' | 'down' | 'stable' | 'unknown';

export interface BehaviorInput {
  /** Ajudas quitadas: comparar quando venceu vs quando foi quitada (atraso real). */
  settled: { dueDate: Date; settledAt: Date }[];
  /** Pagamentos avisados pelo sobrinho e o desfecho (loop de confiança). */
  claims: { status: 'PENDING' | 'CONFIRMED' | 'REJECTED' }[];
  /** Timestamps de acesso do sobrinho ao app (engajamento + melhor horário). */
  logins: Date[];
  now: Date;
}

export interface BestTime { weekday: number; hour: number; label: string }

export interface DebtorProfile {
  sampleSize: number; // nº de quitadas (confiança do perfil)
  avgDelayDays: number | null; // atraso médio (dias); negativo = adianta
  onTimeRate: number | null; // fração quitada no prazo (0..1)
  reliability: Reliability;
  claimConfirmRate: number | null; // avisos confirmados / (confirmados+rejeitados)
  logins30d: number;
  lastLoginDaysAgo: number | null;
  engagementTrend: Trend;
  bestTime: BestTime | null; // #6 — melhor janela para lembrar
  summary: string; // frase curta e amigável (mobile)
}

const DAY = 86_400_000;
const GRACE_DAYS = 2; // "no prazo" tolera 2 dias
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function periodo(hour: number): string {
  if (hour < 6) return 'de madrugada';
  if (hour < 12) return 'de manhã';
  if (hour < 18) return 'à tarde';
  return 'à noite';
}

export function debtorProfile(input: BehaviorInput): DebtorProfile {
  const { settled, claims, logins, now } = input;

  // Atraso real nas quitadas.
  const delays = settled.map((s) => Math.round((s.settledAt.getTime() - s.dueDate.getTime()) / DAY));
  const sampleSize = delays.length;
  const avgDelayDays = sampleSize > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / sampleSize) : null;
  const onTimeRate = sampleSize > 0 ? delays.filter((d) => d <= GRACE_DAYS).length / sampleSize : null;

  let reliability: Reliability = 'unknown';
  if (sampleSize > 0 && onTimeRate != null && avgDelayDays != null) {
    if (onTimeRate >= 0.7) reliability = 'reliable';
    else if (avgDelayDays <= 15) reliability = 'usually_late';
    else reliability = 'unpredictable';
  }

  // Taxa de confirmação de avisos.
  const resolved = claims.filter((c) => c.status !== 'PENDING');
  const claimConfirmRate = resolved.length > 0 ? resolved.filter((c) => c.status === 'CONFIRMED').length / resolved.length : null;

  // Engajamento: logins nos últimos 30d vs 30d anteriores + último acesso.
  const t = now.getTime();
  const logins30d = logins.filter((d) => t - d.getTime() <= 30 * DAY).length;
  const loginsPrev30 = logins.filter((d) => t - d.getTime() > 30 * DAY && t - d.getTime() <= 60 * DAY).length;
  const lastLoginDaysAgo = logins.length > 0 ? Math.floor((t - Math.max(...logins.map((d) => d.getTime()))) / DAY) : null;
  let engagementTrend: Trend = 'unknown';
  if (logins.length >= 2) {
    if (logins30d > loginsPrev30) engagementTrend = 'up';
    else if (logins30d < loginsPrev30) engagementTrend = 'down';
    else engagementTrend = 'stable';
  }

  // #6 Melhor horário: moda de (dia da semana, faixa de hora) dos logins.
  let bestTime: BestTime | null = null;
  if (logins.length >= 3) {
    const buckets = new Map<string, { count: number; weekday: number; hour: number }>();
    for (const d of logins) {
      const weekday = d.getDay();
      const hour = d.getHours();
      const key = `${weekday}-${Math.floor(hour / 6)}`; // faixas de 6h
      const cur = buckets.get(key);
      if (cur) cur.count++;
      else buckets.set(key, { count: 1, weekday, hour });
    }
    const top = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
    if (top && top.count >= 2) bestTime = { weekday: top.weekday, hour: top.hour, label: `${WEEKDAYS[top.weekday]} ${periodo(top.hour)}` };
  }

  return {
    sampleSize, avgDelayDays, onTimeRate, reliability, claimConfirmRate,
    logins30d, lastLoginDaysAgo, engagementTrend, bestTime,
    summary: buildSummary({ sampleSize, avgDelayDays, onTimeRate, reliability, lastLoginDaysAgo, engagementTrend }),
  };
}

function buildSummary(p: Pick<DebtorProfile, 'sampleSize' | 'avgDelayDays' | 'onTimeRate' | 'reliability' | 'lastLoginDaysAgo' | 'engagementTrend'>): string {
  if (p.reliability === 'unknown') {
    return p.lastLoginDaysAgo == null
      ? 'Ainda sem histórico suficiente para um perfil.'
      : 'Perfil em formação — poucas ajudas concluídas até agora.';
  }
  const on = Math.round((p.onTimeRate ?? 0) * 100);
  let base: string;
  if (p.reliability === 'reliable') base = `Costuma pagar no prazo (${on}% das ajudas em dia).`;
  else if (p.reliability === 'usually_late') base = `Costuma pagar com atraso de ~${p.avgDelayDays} dia${p.avgDelayDays === 1 ? '' : 's'}, mas honra.`;
  else base = `Pagamentos irregulares (atraso médio de ~${p.avgDelayDays} dias).`;
  if (p.engagementTrend === 'down' && (p.lastLoginDaysAgo ?? 0) > 14) base += ' Engajamento em queda.';
  return base;
}
