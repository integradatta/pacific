import { describe, it, expect } from 'vitest';
import { debtorProfile, cashForecast, coolingScore, contractGuidance, pricingHint } from './behavior.js';

const now = new Date('2026-07-02T12:00:00Z');
const d = (iso: string) => new Date(iso);

describe('debtorProfile', () => {
  it('sem histórico → unknown', () => {
    const p = debtorProfile({ settled: [], claims: [], logins: [], now });
    expect(p.reliability).toBe('unknown');
    expect(p.sampleSize).toBe(0);
    expect(p.summary).toMatch(/sem hist|forma/i);
  });

  it('quita no prazo → reliable', () => {
    const settled = [
      { dueDate: d('2026-06-01'), settledAt: d('2026-06-01') },
      { dueDate: d('2026-05-01'), settledAt: d('2026-05-02') },
      { dueDate: d('2026-04-01'), settledAt: d('2026-03-30') },
    ];
    const p = debtorProfile({ settled, claims: [], logins: [], now });
    expect(p.reliability).toBe('reliable');
    expect(p.onTimeRate).toBe(1);
    expect(p.summary).toMatch(/no prazo/i);
  });

  it('atrasa pouco mas paga → usually_late', () => {
    const settled = [
      { dueDate: d('2026-06-01'), settledAt: d('2026-06-08') }, // +7
      { dueDate: d('2026-05-01'), settledAt: d('2026-05-10') }, // +9
    ];
    const p = debtorProfile({ settled, claims: [], logins: [], now });
    expect(p.reliability).toBe('usually_late');
    expect(p.avgDelayDays).toBe(8);
  });

  it('atraso alto → unpredictable', () => {
    const settled = [{ dueDate: d('2026-05-01'), settledAt: d('2026-06-10') }]; // +40
    const p = debtorProfile({ settled, claims: [], logins: [], now });
    expect(p.reliability).toBe('unpredictable');
  });

  it('DebtorScore: pontual pontua alto + explicação legível; irregular pontua baixo', () => {
    const bom = debtorProfile({ settled: [
      { dueDate: d('2026-06-01'), settledAt: d('2026-06-01') },
      { dueDate: d('2026-05-01'), settledAt: d('2026-05-01') },
      { dueDate: d('2026-04-01'), settledAt: d('2026-04-02') },
    ], claims: [{ status: 'CONFIRMED' }], logins: [now, now, now], locationConsent: 'GRANTED', now });
    expect(bom.score).not.toBeNull();
    expect(bom.score!).toBeGreaterThanOrEqual(70);
    expect(bom.scoreExplanation).toMatch(/\/100/);
    expect(bom.scoreExplanation).toMatch(/no prazo/);

    const ruim = debtorProfile({ settled: [{ dueDate: d('2026-05-01'), settledAt: d('2026-06-10') }], claims: [], logins: [], renegotiations: 2, locationConsent: 'REVOKED', now });
    expect(ruim.score!).toBeLessThan(bom.score!);
  });

  it('sem histórico → score null', () => {
    const p = debtorProfile({ settled: [], claims: [], logins: [], now });
    expect(p.score).toBeNull();
  });

  it('score é sempre clampado em [0, 100] — mesmo em extremos patológicos', () => {
    // Péssimo em tudo: atraso enorme, renegociações, promessas quebradas, localização revogada.
    const pessimo = debtorProfile({
      settled: [{ dueDate: d('2026-01-01'), settledAt: d('2026-06-01') }],
      claims: [{ status: 'REJECTED' }, { status: 'REJECTED' }],
      logins: [],
      renegotiations: 10,
      promisesBroken: 10,
      locationConsent: 'REVOKED',
      now,
    });
    expect(pessimo.score!).toBeGreaterThanOrEqual(0);
    // Perfeito em tudo: sempre no prazo, confirmado, engajado, promessas cumpridas, GRANTED.
    const perfeito = debtorProfile({
      settled: [
        { dueDate: d('2026-06-01'), settledAt: d('2026-05-30') },
        { dueDate: d('2026-05-01'), settledAt: d('2026-04-28') },
      ],
      claims: [{ status: 'CONFIRMED' }, { status: 'CONFIRMED' }],
      logins: [d('2026-07-01'), d('2026-06-30'), d('2026-06-28'), d('2026-06-25')],
      promisesKept: 10,
      locationConsent: 'GRANTED',
      now,
    });
    expect(perfeito.score!).toBeLessThanOrEqual(100);
  });

  it('promessas movem o score: cumprir sobe, quebrar desce (e entram na explicação)', () => {
    const base = {
      settled: [{ dueDate: d('2026-06-01'), settledAt: d('2026-06-01') }],
      claims: [],
      logins: [],
      now,
    };
    const neutro = debtorProfile(base);
    const cumpridor = debtorProfile({ ...base, promisesKept: 2 });
    const quebrador = debtorProfile({ ...base, promisesBroken: 2 });
    expect(cumpridor.score!).toBeGreaterThan(neutro.score!);
    expect(quebrador.score!).toBeLessThan(neutro.score!);
    expect(cumpridor.scoreExplanation).toMatch(/cumpriu 2 promessas/);
    expect(quebrador.scoreExplanation).toMatch(/não cumpriu 2 promessas/);
  });

  it('melhor horário = moda dos logins (≥3)', () => {
    const logins = [d('2026-06-28T20:00:00'), d('2026-06-21T21:00:00'), d('2026-06-14T20:30:00')]; // domingos à noite
    const p = debtorProfile({ settled: [], claims: [], logins, now });
    expect(p.bestTime).not.toBeNull();
    expect(p.bestTime?.label).toMatch(/à noite/);
  });

  it('taxa de confirmação de avisos', () => {
    const claims = [{ status: 'CONFIRMED' as const }, { status: 'CONFIRMED' as const }, { status: 'REJECTED' as const }, { status: 'PENDING' as const }];
    const p = debtorProfile({ settled: [], claims, logins: [], now });
    expect(p.claimConfirmRate).toBeCloseTo(2 / 3);
  });
});

describe('cashForecast', () => {
  it('provável ≤ nominal e faixas coerentes', () => {
    const items = [
      { amountDue: 1000, probability: 0.9, dueDate: d('2026-07-10') },
      { amountDue: 600, probability: 0.4, dueDate: d('2026-08-05') },
    ];
    const f = cashForecast(items, now, 90);
    expect(f.nominal).toBe(1600);
    expect(f.expected).toBe(1000 * 0.9 + 600 * 0.4); // 1140
    expect(f.optimistic).toBe(1600);
    expect(f.pessimistic).toBe(1000); // só o de prob ≥ 70%
    expect(f.buckets.length).toBe(2);
    expect(f.expected).toBeLessThanOrEqual(f.nominal);
  });

  it('ignora o que vence fora do horizonte', () => {
    const f = cashForecast([{ amountDue: 500, probability: 1, dueDate: d('2027-01-01') }], now, 90);
    expect(f.count).toBe(0);
  });
});

describe('coolingScore', () => {
  it('desengajado + vencido + prob baixa → esfriando', () => {
    const c = coolingScore({ daysToDue: -5, lastLoginDaysAgo: 25, engagementTrend: 'down', locationGranted: false, locationSilentDays: null, paymentProbability: 30 });
    expect(c.cooling).toBe(true);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('ativo, no prazo, boa prob → não esfriando', () => {
    const c = coolingScore({ daysToDue: 20, lastLoginDaysAgo: 2, engagementTrend: 'up', locationGranted: true, locationSilentDays: 0, paymentProbability: 85 });
    expect(c.cooling).toBe(false);
    expect(c.score).toBe(0);
  });
});

describe('contractGuidance', () => {
  it('quitada → calm, sem evidências', () => {
    const g = contractGuidance({ settled: true, daysRemaining: -10, paymentProbability: 10, score: 20, scoreTrend: 'down', reliability: 'unpredictable' });
    expect(g.tone).toBe('calm');
    expect(g.because).toHaveLength(0);
  });

  it('vencida + prob baixa + score frágil + piorando → act (tom sugestivo)', () => {
    const g = contractGuidance({ settled: false, daysRemaining: -12, paymentProbability: 25, score: 30, scoreTrend: 'down', reliability: 'unpredictable' });
    expect(g.tone).toBe('act');
    expect(g.headline).toMatch(/eu alinharia|conversa/i); // sugere, não ordena
    expect(g.because.length).toBeGreaterThan(0);
  });

  it('no prazo + boa prob + bom histórico → calm', () => {
    const g = contractGuidance({ settled: false, daysRemaining: 40, paymentProbability: 82, score: 78, scoreTrend: 'up', reliability: 'reliable' });
    expect(g.tone).toBe('calm');
  });
});

describe('pricingHint', () => {
  it('amostra pequena → não mostra', () => {
    const h = { sampleSize: 3, medianRateMonthlyPct: 5, avgRateMonthlyPct: 5, onTimeBelowMedian: 0.9, onTimeAboveMedian: 0.5 };
    expect(pricingHint(h, 8).show).toBe(false);
  });

  it('taxa alta piora pagamento + proposta acima da mediana → watch (sugestivo)', () => {
    const h = { sampleSize: 12, medianRateMonthlyPct: 5, avgRateMonthlyPct: 6, onTimeBelowMedian: 0.9, onTimeAboveMedian: 0.5 };
    const r = pricingHint(h, 8);
    expect(r.show).toBe(true);
    expect(r.tone).toBe('watch');
    expect(r.text).toMatch(/decisão é sua/i);
  });

  it('sem correlação material → calm informativo', () => {
    const h = { sampleSize: 12, medianRateMonthlyPct: 5, avgRateMonthlyPct: 5, onTimeBelowMedian: 0.85, onTimeAboveMedian: 0.82 };
    expect(pricingHint(h, 9).tone).toBe('calm');
  });
});
