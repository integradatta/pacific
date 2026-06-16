import { describe, it, expect } from 'vitest';
import { generateOrgCode, ORG_CODE_REGEX, generateUniqueOrgCode } from './org-code';

describe('generateOrgCode', () => {
  it('gera no formato PAC-XXXX-XXXX em base32 de Crockford (sem I L O U)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOrgCode();
      expect(code).toMatch(ORG_CODE_REGEX);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
  it('gera valores distintos', () => {
    expect(generateOrgCode()).not.toBe(generateOrgCode());
  });
});

describe('generateUniqueOrgCode', () => {
  it('repete enquanto o código já existe e retorna o primeiro livre', async () => {
    const usados = new Set<string>();
    let chamadas = 0;
    const exists = async (c: string): Promise<boolean> => { chamadas++; return chamadas === 1 ? true : usados.has(c); };
    const code = await generateUniqueOrgCode(exists);
    expect(code).toMatch(ORG_CODE_REGEX);
    expect(chamadas).toBeGreaterThanOrEqual(2);
  });
});
