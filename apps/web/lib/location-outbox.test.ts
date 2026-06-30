import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, peek, commit, size, clear, type OutboxPoint } from './location-outbox';

const p = (n: number): OutboxPoint => ({ lat: n, lng: n, accuracy: null, recordedAt: `2026-06-30T00:00:0${n}Z` });

describe('location-outbox (resiliência de pings)', () => {
  beforeEach(() => clear());

  it('enqueue/peek/commit em FIFO (envia os mais antigos primeiro)', () => {
    enqueue([p(1), p(2), p(3)]);
    expect(size()).toBe(3);
    expect(peek(2).map((x) => x.lat)).toEqual([1, 2]);
    commit(2); // remove os 2 enviados
    expect(size()).toBe(1);
    expect(peek(10).map((x) => x.lat)).toEqual([3]);
  });

  it('enqueue acumula (não perde o que já estava na fila)', () => {
    enqueue([p(1)]);
    enqueue([p(2)]);
    expect(peek(10).map((x) => x.lat)).toEqual([1, 2]);
  });

  it('clear esvazia a fila', () => {
    enqueue([p(1), p(2)]);
    clear();
    expect(size()).toBe(0);
  });
});
