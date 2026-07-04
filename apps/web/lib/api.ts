import { supabase } from './supabase';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// Um único núcleo para todos os métodos: injeta o Bearer da sessão, serializa o corpo e
// desserializa a resposta (tolerando 204/corpo vazio). GET não manda Content-Type/corpo.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const hasBody = body !== undefined;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (hasBody) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body);
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body);
export const apiDelete = <T>(path: string, body?: unknown): Promise<T> => request<T>('DELETE', path, body);
