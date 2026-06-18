import { describe, it, expect } from 'vitest';
import { daysUntil } from './date.utils';
describe('daysUntil', () => {
  it('positivo no futuro', () => {
    expect(daysUntil(new Date('2026-06-26T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(10);
  });
  it('negativo se vencido', () => {
    expect(daysUntil(new Date('2026-06-13T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(-3);
  });
});
