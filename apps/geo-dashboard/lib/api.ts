// Cliente do geo-api. Auth via JWT da plataforma principal (Bearer). Token de demo em
// localStorage('geo_token'); em produção viria do fluxo de login da plataforma.
const BASE = process.env.NEXT_PUBLIC_GEO_API_URL ?? 'http://localhost:3334';

function authHeader(): Record<string, string> {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('geo_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...authHeader() }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return (await res.json()) as T;
}

export async function apiSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Falha (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const GEO_API_BASE = BASE;

export interface GroupRow { id: string; name: string; group_type: 'supervised' | 'collaborative'; }
export interface PositionRow { user_id: string; lat: number; lng: number; recorded_at: string; }
export interface GeofenceRow { id: string; name: string; lat: number; lng: number; radius_meters: number; alert_type: string; }
