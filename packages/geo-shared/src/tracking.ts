// Lógica pura de rastreamento do app móvel (spec §1.8 / §2.4). Sem deps de RN → testável.

export const INTERVAL_MOVING_MS = 5 * 60 * 1000; // em movimento
export const INTERVAL_STOPPED_MS = 10 * 60 * 1000; // parado
export const QUEUE_MAX = 500;
export const BACKOFF_MAX_MS = 60 * 1000;

/** Intervalo adaptativo por velocidade: parado (<1 m/s) → 10 min; movendo (>5 m/s) → 5 min. */
export function adaptiveIntervalMs(speedMps: number | null | undefined): number {
  if (speedMps != null && speedMps < 1) return INTERVAL_STOPPED_MS;
  if (speedMps != null && speedMps > 5) return INTERVAL_MOVING_MS;
  return INTERVAL_MOVING_MS;
}

/** Backoff exponencial 1s,2s,4s,…,máx 60s (attempt começa em 0). */
export function backoffDelayMs(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, 1000 * 2 ** Math.max(0, attempt));
}

/** Adiciona à fila local, descartando os mais antigos ao exceder o limite (FIFO). */
export function pushToQueue<T>(queue: readonly T[], item: T, max: number = QUEUE_MAX): T[] {
  const next = [...queue, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Indisponibilidade: sem ponto por mais de 3× o intervalo configurado (spec §1.8).
 * `lastReceivedAtMs` null = nunca recebeu.
 */
export function isSharingUnavailable(lastReceivedAtMs: number | null, intervalMs: number, now: number): boolean {
  if (lastReceivedAtMs == null) return false;
  return now - lastReceivedAtMs > 3 * intervalMs;
}
