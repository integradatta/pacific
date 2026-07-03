/**
 * Sanitização de dados antes de QUALQUER log/tracking (data masking). Recursiva e case-insensitive:
 * campos sensíveis viram '[REDACTED]' em qualquer nível de aninhamento. Nunca lança (um logger não
 * pode derrubar a operação que está observando).
 */

// Campos que NUNCA podem aparecer em logs (comparação por substring, case-insensitive).
const FORBIDDEN = [
  'password', 'senha', 'token', 'accesstoken', 'refreshtoken',
  'secret', 'apikey', 'api_key', 'authorization', 'cookie',
  'cpf', 'rg', 'telefone', 'phone', 'email', 'cardnumber',
  'cvv', 'pin', 'privatekey', 'private_key', 'p256dh', 'auth',
] as const;

const MAX_DEPTH = 6; // proteção contra ciclos/estruturas patológicas

function isForbidden(key: string): boolean {
  const k = key.toLowerCase();
  return FORBIDDEN.some((f) => k.includes(f));
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  try {
    if (value == null || depth > MAX_DEPTH) return value == null ? value : '[TRUNCATED]';
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => sanitizeForLog(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isForbidden(k) ? '[REDACTED]' : sanitizeForLog(v, depth + 1);
    }
    return out;
  } catch {
    return '[UNSERIALIZABLE]';
  }
}
