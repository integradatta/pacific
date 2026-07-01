'use client';

// Sessão do devedor: o link mágico é trocado por um JWT próprio (emitido pela API),
// guardado localmente. Diferente do credor (Supabase), o devedor não usa senha.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const KEY = 'pacific_debtor_jwt';

export async function exchangeLink(token: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/debtor/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Link inválido ou expirado');
  const data = (await res.json()) as { token: string };
  localStorage.setItem(KEY, data.token);
}

export function getDebtorJwt(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(KEY);
}

export function clearDebtorJwt(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export async function debtorApiGet<T>(path: string): Promise<T> {
  const jwt = getDebtorJwt();
  const res = await fetch(`${BASE}${path}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return (await res.json()) as T;
}

export async function debtorApiPost<T>(path: string, body?: unknown): Promise<T> {
  const jwt = getDebtorJwt();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Falha (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
