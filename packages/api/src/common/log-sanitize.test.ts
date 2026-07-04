import { describe, it, expect } from 'vitest';
import { sanitizeForLog } from './log-sanitize.js';

describe('sanitizeForLog', () => {
  it('remove password de objetos simples', () => {
    expect(sanitizeForLog({ userId: '123', password: 'abc123', action: 'login' })).toEqual({
      userId: '123', password: '[REDACTED]', action: 'login',
    });
  });

  it('remove token/secret de objetos aninhados (recursivo)', () => {
    const out = sanitizeForLog({ meta: { auth: { accessToken: 'x', deep: { apiKey: 'y' } } }, ok: 1 }) as Record<string, unknown>;
    expect(out).toEqual({ meta: { auth: '[REDACTED]' }, ok: 1 });
  });

  it('preserva campos não sensíveis intactos (inclusive arrays e datas)', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(sanitizeForLog({ ids: [1, 2], when: d, note: 'oi' })).toEqual({ ids: [1, 2], when: d.toISOString(), note: 'oi' });
  });

  it('funciona com null e undefined sem quebrar', () => {
    expect(sanitizeForLog(null)).toBeNull();
    expect(sanitizeForLog(undefined)).toBeUndefined();
    expect(sanitizeForLog({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
  });

  it('é case-insensitive (PASSWORD, Password, password) e pega variantes por substring', () => {
    const out = sanitizeForLog({ PASSWORD: 'a', Password: 'b', refreshToken: 'c', api_key: 'd', Authorization: 'e', CPF: 'f' });
    expect(out).toEqual({ PASSWORD: '[REDACTED]', Password: '[REDACTED]', refreshToken: '[REDACTED]', api_key: '[REDACTED]', Authorization: '[REDACTED]', CPF: '[REDACTED]' });
  });

  it('mascara chaves de push subscription (p256dh/auth/endpoint fica, chaves não)', () => {
    const out = sanitizeForLog({ endpoint: 'https://push/x', keys: { p256dh: 'k1', auth: 'k2' } });
    expect(out).toEqual({ endpoint: 'https://push/x', keys: { p256dh: '[REDACTED]', auth: '[REDACTED]' } });
  });

  it('trunca profundidade patológica em vez de estourar a pilha', () => {
    type Nested = { n?: Nested };
    const deep: Nested = {};
    let cur = deep;
    for (let i = 0; i < 20; i++) { cur.n = {}; cur = cur.n; }
    expect(() => sanitizeForLog(deep)).not.toThrow();
  });
});
