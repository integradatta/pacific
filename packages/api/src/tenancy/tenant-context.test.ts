import { describe, it, expect } from 'vitest';
import { resolveTenantId } from './tenant-context.js';
import type { AuthUser } from '@pacific/shared';

const u = (p: Partial<AuthUser>): AuthUser => ({ supabaseId: 's', email: 'e', role: 'CREDITOR', tenantId: 't1', ...p });

describe('resolveTenantId', () => {
  it('credor usa o tenant do token', () => { expect(resolveTenantId(u({}), undefined)).toBe('t1'); });
  it('credor sem tenant é erro', () => { expect(() => resolveTenantId(u({ tenantId: null }), undefined)).toThrow(); });
  it('super-admin usa o header explícito', () => {
    expect(resolveTenantId(u({ role: 'SUPER_ADMIN', tenantId: null }), 'tX')).toBe('tX');
  });
  it('super-admin sem header é erro', () => {
    expect(() => resolveTenantId(u({ role: 'SUPER_ADMIN', tenantId: null }), undefined)).toThrow();
  });
});
