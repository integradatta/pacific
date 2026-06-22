import * as SecureStore from 'expo-secure-store';

// Cliente do geo-api. Auth via JWT da plataforma principal (Bearer). O token é obtido pelo
// fluxo de login da plataforma e guardado no SecureStore (aqui só lemos).
const BASE = process.env.EXPO_PUBLIC_GEO_API_URL ?? 'http://localhost:3334';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('geo_token');
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function apiSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface PositionRow { user_id: string; lat: number; lng: number; recorded_at: string }
