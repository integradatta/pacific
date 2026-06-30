import { describe, it, expect } from 'vitest';
import { formatBRL, venceEm } from './format';

describe('formatBRL', () => {
  it('formata valor em BRL (pt-BR)', () => {
    // Normaliza espaços (o ICU usa espaço fixo entre R$ e o número).
    expect(formatBRL('1234.5').replace(/\s/g, '')).toBe('R$1.234,50');
    expect(formatBRL('0').replace(/\s/g, '')).toBe('R$0,00');
    expect(formatBRL('1000000').replace(/\s/g, '')).toBe('R$1.000.000,00');
  });
});

describe('venceEm', () => {
  it('vencido / hoje / futuro', () => {
    expect(venceEm(-3)).toBe('vencido há 3d');
    expect(venceEm(0)).toBe('vence hoje');
    expect(venceEm(12)).toBe('em 12d');
  });
});
