// Etiquetas de operação — regras únicas e compartilhadas (API valida, web pré-valida).
export const TAG_MAX_COUNT = 8;
export const TAG_MAX_LENGTH = 24;

/**
 * Normaliza uma lista de etiquetas: apara espaços, minúsculas, remove vazias e duplicatas,
 * corta no tamanho máximo e limita a quantidade. Determinística e idempotente.
 */
export function normalizeTags(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase().slice(0, TAG_MAX_LENGTH);
    if (tag === '' || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAG_MAX_COUNT) break;
  }
  return out;
}
