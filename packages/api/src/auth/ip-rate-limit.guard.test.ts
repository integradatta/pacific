import { describe, it, expect } from 'vitest';
import { IpRateLimitGuard } from './ip-rate-limit.guard.js';
import type { ExecutionContext } from '@nestjs/common';

const ctx = (ip: string): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ ip, headers: {} }) }) }) as unknown as ExecutionContext;

describe('IpRateLimitGuard', () => {
  it('bloqueia após exceder o limite na janela', () => {
    const guard = new IpRateLimitGuard(3, 60_000);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(() => guard.canActivate(ctx('1.1.1.1'))).toThrow();
  });
  it('chaves diferentes não interferem', () => {
    const guard = new IpRateLimitGuard(1, 60_000);
    expect(guard.canActivate(ctx('a'))).toBe(true);
    expect(guard.canActivate(ctx('b'))).toBe(true);
  });
});
