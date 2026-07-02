import { describe, it, expect } from 'vitest';
import { debtorProfile, cashForecast, coolingScore } from './behavior.js';

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
