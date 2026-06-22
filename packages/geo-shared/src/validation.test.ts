import { describe, it, expect } from 'vitest';
import { validateIncomingPoint, haversineMeters, type PreviousPoint } from './validation.js';
import type { IncomingPoint } from './types.js';

const NOW = new Date('2026-06-21T12:00:00Z');
const base: IncomingPoint = {
  lat: -23.5505,
  lng: -46.6333,
  accuracyMeters: 15,
  source: 'gps',
  recordedAt: '2026-06-21T11:59:30Z',
};

describe('haversineMeters', () => {
  it('~0 para o mesmo ponto e ~111km por grau de latitude', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(0, 5);
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110_000);
  });
});

describe('validateIncomingPoint', () => {
  it('aceita ponto bom', () => {
    expect(validateIncomingPoint(base, null, NOW)).toMatchObject({ accept: true, flags: [] });
  });
  it('rejeita accuracy > 500m', () => {
    expect(validateIncomingPoint({ ...base, accuracyMeters: 600 }, null, NOW)).toMatchObject({ accept: false, reason: 'low_accuracy' });
  });
  it('rejeita timestamp futuro (> 5 min) e muito antigo (> 24h)', () => {
    expect(validateIncomingPoint({ ...base, recordedAt: '2026-06-21T12:10:00Z' }, null, NOW)).toMatchObject({ accept: false, reason: 'future_timestamp' });
    expect(validateIncomingPoint({ ...base, recordedAt: '2026-06-19T12:00:00Z' }, null, NOW)).toMatchObject({ accept: false, reason: 'stale_timestamp' });
  });
  it('rejeita teleporte (> 340 m/s)', () => {
    const prev: PreviousPoint = { lat: -23.5505, lng: -46.6333, recordedAt: '2026-06-21T11:59:29Z' };
    // ~1 grau de distância (~111km) em 1s → muito acima de 340 m/s
    const far: IncomingPoint = { ...base, lat: -22.5505, recordedAt: '2026-06-21T11:59:30Z' };
    expect(validateIncomingPoint(far, prev, NOW)).toMatchObject({ accept: false, reason: 'teleport' });
  });
  it('marca suspicious (>55 m/s, gps) mas aceita', () => {
    const prev: PreviousPoint = { lat: -23.5505, lng: -46.6333, recordedAt: '2026-06-21T11:59:00Z' };
    // ~2.2km em 30s ≈ 73 m/s
    const fast: IncomingPoint = { ...base, lat: -23.5705, recordedAt: '2026-06-21T11:59:30Z' };
    const r = validateIncomingPoint(fast, prev, NOW);
    expect(r.accept).toBe(true);
    expect(r.flags).toContain('suspicious');
  });
  it('rejeita timestamp inválido', () => {
    expect(validateIncomingPoint({ ...base, recordedAt: 'xx' }, null, NOW)).toMatchObject({ accept: false, reason: 'invalid_timestamp' });
  });
});
