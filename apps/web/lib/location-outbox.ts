'use client';

// Fila persistente de pings (localStorage) — sobrevive a recarregamento, suspensão do app e quedas
// de rede. Os pontos só saem da fila após envio confirmado (sem perda em falha transitória).
export interface OutboxPoint { lat: number; lng: number; accuracy: number | null; recordedAt: string }

const KEY = 'pacific_loc_outbox';
const MAX = 600; // teto de segurança: descarta os mais ANTIGOS além disso (evita crescer sem limite)

function read(): OutboxPoint[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as OutboxPoint[]) : [];
  } catch {
    return [];
  }
}
function write(points: OutboxPoint[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(points.slice(-MAX)));
  } catch {
    /* quota cheia: ignora (perde o excedente, não derruba o app) */
  }
}

export function enqueue(points: OutboxPoint[]): void {
  if (points.length > 0) write([...read(), ...points]);
}
/** Primeiros `n` pontos (FIFO) sem remover — removidos só após envio confirmado via commit(). */
export function peek(n: number): OutboxPoint[] {
  return read().slice(0, n);
}
export function commit(n: number): void {
  write(read().slice(n));
}
export function size(): number {
  return read().length;
}
export function clear(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
