// Crockford base32 sem caracteres ambíguos (sem I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORG_CODE_REGEX = /^PAC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

// Inteiro uniforme em [0, max) por rejeição (sem viés), via Web Crypto.
// Isomórfico: globalThis.crypto existe no Node 19+ e no navegador (pacote usado em ambos).
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  let x: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
}

function block(): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[randomIndex(ALPHABET.length)]!;
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
