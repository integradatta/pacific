import { randomInt } from 'node:crypto';
// Crockford base32 sem caracteres ambíguos (sem I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORG_CODE_REGEX = /^PAC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
function block(): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[randomInt(ALPHABET.length)]!;
  return out;
}
export function generateOrgCode(): string { return `PAC-${block()}-${block()}`; }
export async function generateUniqueOrgCode(
  exists: (code: string) => Promise<boolean>, maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateOrgCode();
    if (!(await exists(code))) return code;
  }
  throw new Error('Não foi possível gerar orgCode único');
}
