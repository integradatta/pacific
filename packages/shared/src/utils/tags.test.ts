import { describe, it, expect } from 'vitest';
import { normalizeTags, TAG_MAX_COUNT, TAG_MAX_LENGTH } from './tags.js';

describe('normalizeTags', () => {
  it('apara, minúsculas e remove vazias', () => {
    expect(normalizeTags(['  Judicial ', 'NEGOCIANDO', '   ', ''])).toEqual(['judicial', 'negociando']);
  });
  it('remove duplicatas (após normalizar)', () => {
    expect(normalizeTags(['vip', 'VIP', ' Vip '])).toEqual(['vip']);
  });
  it('corta no tamanho máximo', () => {
    const long = 'a'.repeat(TAG_MAX_LENGTH + 10);
    expect(normalizeTags([long])).toEqual(['a'.repeat(TAG_MAX_LENGTH)]);
  });
  it('limita a quantidade máxima', () => {
    const many = Array.from({ length: TAG_MAX_COUNT + 5 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(TAG_MAX_COUNT);
  });
  it('é idempotente', () => {
    const once = normalizeTags(['A', 'b ', 'b']);
    expect(normalizeTags(once)).toEqual(once);
  });
  it('ignora itens não-string com segurança', () => {
    expect(normalizeTags(['ok', undefined as unknown as string, 42 as unknown as string])).toEqual(['ok']);
  });
});
