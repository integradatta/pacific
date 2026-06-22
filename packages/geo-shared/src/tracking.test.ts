import { describe, it, expect } from 'vitest';
import { adaptiveIntervalMs, backoffDelayMs, pushToQueue, isSharingUnavailable, INTERVAL_MOVING_MS, INTERVAL_STOPPED_MS, QUEUE_MAX, BACKOFF_MAX_MS } from './tracking.js';

describe('adaptiveIntervalMs', () => {
  it('parado → 10 min; movendo → 5 min; intermediário → 5 min; sem dado → 5 min', () => {
    expect(adaptiveIntervalMs(0)).toBe(INTERVAL_STOPPED_MS);
    expect(adaptiveIntervalMs(10)).toBe(INTERVAL_MOVING_MS);
    expect(adaptiveIntervalMs(3)).toBe(INTERVAL_MOVING_MS);
    expect(adaptiveIntervalMs(null)).toBe(INTERVAL_MOVING_MS);
  });
});

describe('backoffDelayMs', () => {
  it('exponencial com teto de 60s', () => {
    expect(backoffDelayMs(0)).toBe(1000);
    expect(backoffDelayMs(3)).toBe(8000);
    expect(backoffDelayMs(20)).toBe(BACKOFF_MAX_MS);
  });
});

describe('pushToQueue', () => {
  it('descarta os mais antigos ao exceder o limite', () => {
    let q: number[] = [];
    for (let i = 0; i < QUEUE_MAX + 10; i++) q = pushToQueue(q, i);
    expect(q.length).toBe(QUEUE_MAX);
    expect(q[0]).toBe(10); // os 10 primeiros caíram
    expect(q[q.length - 1]).toBe(QUEUE_MAX + 9);
  });
});

describe('isSharingUnavailable', () => {
  it('true se passou > 3× o intervalo; false se nunca recebeu', () => {
    expect(isSharingUnavailable(null, 1000, 999999)).toBe(false);
    expect(isSharingUnavailable(0, 1000, 3001)).toBe(true);
    expect(isSharingUnavailable(0, 1000, 2999)).toBe(false);
  });
});
