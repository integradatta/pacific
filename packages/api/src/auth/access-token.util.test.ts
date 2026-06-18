import { describe, it, expect } from 'vitest';
import { generateAccessToken, hashAccessToken } from './access-token.util.js';

describe('access token', () => {
  it('gera token base64url de alta entropia, único', () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes em base64url
    expect(a).not.toBe(b);
  });
  it('hash é sha256 hex determinístico (64 chars) e difere por token', () => {
    expect(hashAccessToken('abc')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAccessToken('abc')).toBe(hashAccessToken('abc'));
    expect(hashAccessToken('abc')).not.toBe(hashAccessToken('abd'));
  });
});
