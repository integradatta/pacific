import { describe, it, expect } from 'vitest';
import { ORG_CODE_REGEX, daysUntil } from '@pacific/shared';
import { AllExceptionsFilter } from './http-exception.filter.js';

describe('api canary', () => {
  it('importa @pacific/shared (cross-package ESM)', () => {
    expect('PAC-AAAA-BBBB').toMatch(ORG_CODE_REGEX);
    expect(daysUntil(new Date('2026-06-26T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(10);
  });
  it('decorators NestJS transpilam sob vitest', () => {
    expect(typeof AllExceptionsFilter).toBe('function');
    expect(() => new AllExceptionsFilter()).not.toThrow();
  });
});
