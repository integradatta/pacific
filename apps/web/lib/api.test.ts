// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// O cliente HTTP injeta o Bearer da sessão Supabase — mocka a sessão para isolar o transporte.
vi.mock('./supabase', () => ({
  supabase: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'tok-123' } } }) } }),
}));

import { apiGet, apiPost, apiDelete } from './api';

const okJson = (body: unknown): Response =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;
const empty = (): Response => ({ ok: true, status: 204, text: async () => '' }) as unknown as Response;
const fail = (status: number): Response => ({ ok: false, status, text: async () => 'boom' }) as unknown as Response;

describe('cliente HTTP (lib/api)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('GET desserializa JSON e envia o Bearer da sessão', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ id: 1 }));
    await expect(apiGet<{ id: number }>('/x')).resolves.toEqual({ id: 1 });
    const [, init] = f.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(init!.method).toBe('GET');
  });

  it('API retorna 500 → lança com o status (caso de erro obrigatório)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(500));
    await expect(apiGet('/x')).rejects.toThrow(/500/);
  });

  it('resposta 204/corpo vazio → undefined (não quebra no JSON.parse)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(empty());
    await expect(apiPost<undefined>('/x', { a: 1 })).resolves.toBeUndefined();
  });

  it('queda de rede (fetch rejeita) → propaga o erro', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiGet('/x')).rejects.toThrow(/fetch/i);
  });

  it('POST/DELETE serializam o corpo e setam Content-Type só quando há corpo', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({}));
    await apiPost('/p', { v: 2 });
    await apiDelete('/d');
    const [, postInit] = f.mock.calls[0]!;
    const [, delInit] = f.mock.calls[1]!;
    expect(postInit!.body).toBe('{"v":2}');
    expect((postInit!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(delInit!.body).toBeUndefined();
    expect((delInit!.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
