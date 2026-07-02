import { describe, it, expect } from 'vitest';
import { debtorProfile } from './behavior.js';

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
