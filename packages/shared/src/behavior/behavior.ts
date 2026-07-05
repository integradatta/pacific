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
  /** Nº de renegociações pedidas (sinal leve de dificuldade). */
  renegotiations?: number;
  /** Promessas cumpridas / quebradas (combinou pagar até uma data e cumpriu, ou não). */
  promisesKept?: number;
  promisesBroken?: number;
  /** Estado atual do consentimento de localização (confiança/transparência). */
  locationConsent?: 'GRANTED' | 'REVOKED' | 'DECLINED' | 'NEVER' | null;
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
  score: number | null; // DebtorScore 0..100 ("empresto de novo?"); null = sem histórico
  scoreExplanation: string; // fatores concretos e legíveis
  scoreTrend: Trend; // melhorando / piorando (pelos atrasos recentes)
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

// #6 Melhor horário para lembrar: moda de (dia da semana, faixa de 6h) dos logins. Reusável
// (perfil e radar). Precisa de ≥3 logins e uma janela com ≥2 ocorrências, senão null.
export function bestTimeFromLogins(logins: Date[]): BestTime | null {
  if (logins.length < 3) return null;
  const buckets = new Map<string, { count: number; weekday: number; hour: number }>();
  for (const d of logins) {
    const weekday = d.getDay();
    const hour = d.getHours();
    const key = `${weekday}-${Math.floor(hour / 6)}`;
    const cur = buckets.get(key);
    if (cur) cur.count++;
    else buckets.set(key, { count: 1, weekday, hour });
  }
  const top = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count < 2) return null;
  return { weekday: top.weekday, hour: top.hour, label: `${WEEKDAYS[top.weekday]} ${periodo(top.hour)}` };
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

  const bestTime = bestTimeFromLogins(logins); // #6

  // DebtorScore — atrasos em ordem cronológica (p/ "última" e tendência).
  const sortedDelays = [...settled].sort((a, b) => a.settledAt.getTime() - b.settledAt.getTime()).map((s) => Math.round((s.settledAt.getTime() - s.dueDate.getTime()) / DAY));
  const lastDelay = sortedDelays.length ? sortedDelays[sortedDelays.length - 1]! : null;
  let scoreTrend: Trend = 'unknown';
  if (sortedDelays.length >= 2) {
    const earlier = sortedDelays.slice(0, -1);
    const earlierMean = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    scoreTrend = lastDelay! < earlierMean - 2 ? 'up' : lastDelay! > earlierMean + 2 ? 'down' : 'stable';
  }
  const reneg = input.renegotiations ?? 0;
  const loc = input.locationConsent ?? null;
  const pKept = input.promisesKept ?? 0;
  const pBroken = input.promisesBroken ?? 0;

  let score: number | null = null;
  let scoreExplanation = 'Sem histórico de quitações ainda — perfil em formação.';
  if (sampleSize > 0 && onTimeRate != null) {
    let s = 40 + onTimeRate * 45;
    if (avgDelayDays && avgDelayDays > 0) s -= Math.min(avgDelayDays, 30) * 0.5;
    if (claimConfirmRate != null) s += (claimConfirmRate - 0.5) * 10;
    if (logins30d >= 4) s += 5;
    else if (engagementTrend === 'down' && (lastLoginDaysAgo ?? 0) > 21) s -= 8;
    s -= Math.min(reneg, 3) * 5;
    // Promessas: cumprir o que combinou pesa a favor; quebrar pesa contra (limitado p/ não dominar).
    s += Math.min(pKept, 4) * 3;
    s -= Math.min(pBroken, 4) * 6;
    if (loc === 'GRANTED') s += 3;
    else if (loc === 'REVOKED') s -= 5;
    score = Math.max(0, Math.min(100, Math.round(s)));
    const onCount = Math.round(onTimeRate * sampleSize);
    const parts = [`pagou ${onCount} de ${sampleSize} no prazo`];
    if (lastDelay != null && lastDelay > 2) parts.push(`atrasou a última em ${lastDelay} dias`);
    if (logins30d >= 4) parts.push('acessa o portal com frequência');
    else if (lastLoginDaysAgo != null && lastLoginDaysAgo > 21) parts.push(`sem acessar há ${lastLoginDaysAgo} dias`);
    if (pKept > 0) parts.push(`cumpriu ${pKept} promessa${pKept === 1 ? '' : 's'}`);
    if (pBroken > 0) parts.push(`não cumpriu ${pBroken} promessa${pBroken === 1 ? '' : 's'}`);
    if (reneg > 0) parts.push(`pediu ${reneg} renegociaç${reneg === 1 ? 'ão' : 'ões'}`);
    scoreExplanation = `${score}/100: ${parts.join('; ')}.`;
  }

  return {
    sampleSize, avgDelayDays, onTimeRate, reliability, claimConfirmRate,
    logins30d, lastLoginDaysAgo, engagementTrend, bestTime,
    summary: buildSummary({ sampleSize, avgDelayDays, onTimeRate, reliability, lastLoginDaysAgo, engagementTrend }),
    score, scoreExplanation, scoreTrend,
  };
}

// ── Próxima ação (P1) — leitura SUGESTIVA no nível do contrato ────────────────────────────────
// Sintetiza os sinais já calculados (probabilidade, DebtorScore, tendência, confiabilidade, atraso)
// numa orientação. TOM: sugestão, nunca ordem — o padrinho decide, a plataforma só lê os sinais.
export type GuidanceTone = 'calm' | 'watch' | 'act';
export interface ContractGuidanceInput {
  settled: boolean;
  daysRemaining: number; // <0 = vencida há N dias
  paymentProbability: number; // 0..100
  score: number | null; // DebtorScore 0..100 (null = sem histórico)
  scoreTrend: Trend;
  reliability: Reliability;
}
export interface ContractGuidance {
  tone: GuidanceTone;
  headline: string; // frase sugestiva (o que o padrinho poderia considerar)
  because: string[]; // evidências concretas que embasam a leitura (2–3)
}

export function contractGuidance(i: ContractGuidanceInput): ContractGuidance {
  if (i.settled) return { tone: 'calm', headline: 'Combinado quitado — nada a fazer por aqui.', because: [] };

  const overdue = i.daysRemaining < 0;
  const because: string[] = [];
  let concern = 0;

  if (overdue) { concern += 2; because.push(`vencida há ${Math.abs(i.daysRemaining)} dia${Math.abs(i.daysRemaining) === 1 ? '' : 's'}`); }
  else if (i.daysRemaining <= 7) { concern += 0.5; because.push(`vence em ${i.daysRemaining} dia${i.daysRemaining === 1 ? '' : 's'}`); }

  if (i.paymentProbability < 40) { concern += 1.5; because.push(`probabilidade de pagamento baixa (${i.paymentProbability}%)`); }
  else if (i.paymentProbability >= 70) { concern -= 1; because.push(`probabilidade de pagamento alta (${i.paymentProbability}%)`); }

  if (i.score != null) {
    if (i.score < 45) { concern += 1.5; because.push(`histórico frágil (score ${i.score})`); }
    else if (i.score >= 70) { concern -= 1; because.push(`bom histórico (score ${i.score})`); }
  }
  if (i.scoreTrend === 'down') { concern += 1; because.push('comportamento piorando'); }
  else if (i.scoreTrend === 'up') { concern -= 0.5; because.push('comportamento melhorando'); }

  if (i.reliability === 'unpredictable') { concern += 0.5; if (i.score == null) because.push('pagamentos irregulares'); }
  else if (i.reliability === 'reliable' && i.score == null) { concern -= 0.5; because.push('costuma pagar no prazo'); }

  const tone: GuidanceTone = concern >= 2.5 ? 'act' : concern >= 1 ? 'watch' : 'calm';
  const headline =
    tone === 'act'
      ? overdue
        ? 'No seu lugar, eu alinharia um novo combinado antes de seguir.'
        : 'Talvez valha uma conversa antes de renovar ou aumentar a linha.'
      : tone === 'watch'
        ? overdue
          ? 'Um lembrete gentil pode ajudar a destravar.'
          : 'Vale acompanhar de perto — um lembrete leve perto da data costuma bastar.'
        : i.score == null
          ? 'Sem histórico ainda — vale só observar como este primeiro combinado evolui.'
          : 'Está tranquilo — dá pra deixar seguir no ritmo.';

  return { tone, headline, because: because.slice(0, 3) };
}

// ── Precificação sugestiva (P6) — taxa × desfecho na carteira do próprio padrinho ─────────────
// Lê o histórico REAL do padrinho (quitadas): taxas acima da mediana pagaram melhor ou pior no
// prazo? Posiciona a taxa que ele está digitando. Tom sugestivo; a decisão é sempre dele.
export interface PricingHistory {
  sampleSize: number; // nº de quitadas com desfecho
  medianRateMonthlyPct: number;
  avgRateMonthlyPct: number;
  onTimeBelowMedian: number | null; // fração no prazo (0..1) das taxas ≤ mediana
  onTimeAboveMedian: number | null; // fração no prazo das taxas > mediana
}
export interface PricingHint { show: boolean; tone: 'calm' | 'watch'; text: string }

export function pricingHint(h: PricingHistory, proposedRateMonthlyPct: number): PricingHint {
  if (h.sampleSize < 5 || h.onTimeAboveMedian == null || h.onTimeBelowMedian == null) {
    return { show: false, tone: 'calm', text: '' };
  }
  const pct = (f: number) => Math.round(f * 100);
  const gap = pct(h.onTimeBelowMedian - h.onTimeAboveMedian); // pontos a favor das taxas mais baixas
  if (gap < 12) {
    return { show: true, tone: 'calm', text: `No seu histórico (${h.sampleSize} quitadas), a taxa não tem pesado no pagamento. Média sua: ${h.avgRateMonthlyPct}% a.m.` };
  }
  if (proposedRateMonthlyPct > h.medianRateMonthlyPct) {
    return { show: true, tone: 'watch', text: `Acima da sua mediana (${h.medianRateMonthlyPct}% a.m.), suas operações pagaram no prazo ${pct(h.onTimeAboveMedian)}% das vezes — contra ${pct(h.onTimeBelowMedian)}% abaixo. Vale ponderar; a decisão é sua.` };
  }
  return { show: true, tone: 'calm', text: `Dentro da faixa que, no seu histórico, costuma pagar melhor: ${pct(h.onTimeBelowMedian)}% no prazo abaixo da mediana (${h.medianRateMonthlyPct}% a.m.).` };
}

// ── #4 Previsão de caixa ponderada por probabilidade de pagamento ────────────────────────────
export interface ForecastItem { amountDue: number; probability: number; dueDate: Date } // probability 0..1
export interface ForecastBucket { key: string; label: string; nominal: number; expected: number }
export interface CashForecast {
  horizonDays: number;
  count: number;
  nominal: number; // soma nominal a vencer no horizonte
  expected: number; // provável = Σ valor × probabilidade
  optimistic: number; // todos pagam
  pessimistic: number; // só os de alta probabilidade (≥70%) pagam
  buckets: ForecastBucket[]; // por mês
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function cashForecast(items: ForecastItem[], now: Date, horizonDays = 90): CashForecast {
  const limit = now.getTime() + horizonDays * DAY;
  const inWindow = items.filter((i) => i.dueDate.getTime() <= limit); // inclui atrasados (a receber já)
  const bucketMap = new Map<string, ForecastBucket>();
  let nominal = 0, expected = 0, optimistic = 0, pessimistic = 0;
  for (const i of inWindow) {
    const p = Math.max(0, Math.min(1, i.probability));
    nominal += i.amountDue;
    expected += i.amountDue * p;
    optimistic += i.amountDue;
    if (p >= 0.7) pessimistic += i.amountDue;
    // vencidos entram no mês corrente; futuros no mês do vencimento.
    const ref = i.dueDate.getTime() < now.getTime() ? now : i.dueDate;
    const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    const b = bucketMap.get(key) ?? { key, label: `${MONTHS[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`, nominal: 0, expected: 0 };
    b.nominal += i.amountDue;
    b.expected += i.amountDue * p;
    bucketMap.set(key, b);
  }
  const buckets = [...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { horizonDays, count: inWindow.length, nominal, expected, optimistic, pessimistic, buckets };
}

// ── #5 Radar de esfriamento (sinal composto por sobrinho) ────────────────────────────────────
export interface CoolingInput {
  daysToDue: number; // dias até o vencimento (negativo = vencido)
  lastLoginDaysAgo: number | null; // null = nunca abriu
  engagementTrend: Trend;
  locationGranted: boolean;
  locationSilentDays: number | null; // dias sem sinal (se GRANTED); null = n/a
  paymentProbability: number; // 0..100
}
export interface CoolingResult { score: number; cooling: boolean; reasons: string[] }

// Score 0..100 (quanto maior, mais "esfriando"). Combina desengajamento + proximidade do
// vencimento + baixa probabilidade + silêncio de localização. Só dados já coletados.
export function coolingScore(i: CoolingInput): CoolingResult {
  const reasons: string[] = [];
  let score = 0;
  if (i.lastLoginDaysAgo != null && i.lastLoginDaysAgo >= 21) { score += 30; reasons.push(`sem abrir o app há ${i.lastLoginDaysAgo} dias`); }
  else if (i.lastLoginDaysAgo != null && i.lastLoginDaysAgo >= 10) { score += 15; reasons.push(`pouco ativo (${i.lastLoginDaysAgo} dias sem abrir)`); }
  if (i.engagementTrend === 'down') { score += 12; reasons.push('engajamento em queda'); }
  if (i.daysToDue < 0) { score += 25; reasons.push(`vencido há ${Math.abs(i.daysToDue)} dias`); }
  else if (i.daysToDue <= 7) { score += 15; reasons.push(`vence em ${i.daysToDue} dia${i.daysToDue === 1 ? '' : 's'}`); }
  if (i.paymentProbability < 50) { score += 15; reasons.push('probabilidade de pagamento baixa'); }
  if (i.locationGranted && i.locationSilentDays != null && i.locationSilentDays >= 2) { score += 10; reasons.push(`localização sem sinal há ${i.locationSilentDays} dias`); }
  score = Math.min(100, score);
  return { score, cooling: score >= 40, reasons };
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
