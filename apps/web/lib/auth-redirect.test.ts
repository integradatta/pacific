import { describe, it, expect } from 'vitest';
import { pathForMe, type Me } from './auth-redirect';

const me = (over: Partial<Me>): Me => ({ role: 'CREDITOR', tenantId: 't1', approved: true, termsAccepted: true, ...over });

describe('pathForMe (roteamento por papel)', () => {
  it('OWNER e SUPER_ADMIN vão para /admin', () => {
    expect(pathForMe(me({ role: 'OWNER' }))).toBe('/admin');
    expect(pathForMe(me({ role: 'SUPER_ADMIN', tenantId: null }))).toBe('/admin');
  });
  it('credor sem carteira → /register', () => {
    expect(pathForMe(me({ tenantId: null, approved: false, termsAccepted: false }))).toBe('/register');
  });
  it('credor não aprovado → /pendente', () => {
    expect(pathForMe(me({ approved: false }))).toBe('/pendente');
  });
  it('credor sem aceite de termos → /termos', () => {
    expect(pathForMe(me({ termsAccepted: false }))).toBe('/termos');
  });
  it('credor pronto → /dashboard', () => {
    expect(pathForMe(me({}))).toBe('/dashboard');
  });
});
