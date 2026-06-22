import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('permite até o limite e bloqueia o excedente na janela', () => {
    const rl = new RateLimiter();
    const t = 1000;
    expect(rl.hit('k', 3, 60_000, t)).toBe(true);
    expect(rl.hit('k', 3, 60_000, t + 1)).toBe(true);
    expect(rl.hit('k', 3, 60_000, t + 2)).toBe(true);
    expect(rl.hit('k', 3, 60_000, t + 3)).toBe(false); // 4ª excede
  });
  it('reseta após a janela', () => {
    const rl = new RateLimiter();
    expect(rl.hit('k', 1, 1000, 0)).toBe(true);
    expect(rl.hit('k', 1, 1000, 500)).toBe(false);
    expect(rl.hit('k', 1, 1000, 1000)).toBe(true); // nova janela
  });
  it('chaves independentes', () => {
    const rl = new RateLimiter();
    expect(rl.hit('a', 1, 1000, 0)).toBe(true);
    expect(rl.hit('b', 1, 1000, 0)).toBe(true);
  });
});
