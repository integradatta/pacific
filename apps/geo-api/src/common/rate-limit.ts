// Limitador de taxa in-memory (janela deslizante simples). Suficiente p/ instância única
// (contexto acadêmico). Lógica pura → testável sem Nest. Trocar por Redis se escalar.
interface Bucket {
  windowStart: number;
  count: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  /** Retorna true se permitido; false se excedeu o limite na janela. */
  hit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
    const b = this.buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
      this.buckets.set(key, { windowStart: now, count: 1 });
      return true;
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }

  /** Limpa janelas expiradas (chamar periodicamente p/ não vazar memória). */
  sweep(windowMs: number, now: number = Date.now()): void {
    for (const [k, b] of this.buckets) {
      if (now - b.windowStart >= windowMs) this.buckets.delete(k);
    }
  }
}
