import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { DebtorTokenService } from './debtor-token.service.js';

describe('DebtorTokenService', () => {
  it('assina um JWT de devedor (role DEBTOR, tenantId, debtorId)', () => {
    const svc = new DebtorTokenService('app-secret');
    const token = svc.sign({ debtorId: 'd1', tenantId: 't1' });
    const payload = jwt.verify(token, 'app-secret') as jwt.JwtPayload;
    expect(payload.sub).toBe('d1');
    const meta = payload.app_metadata as { role: string; tenantId: string; debtorId: string };
    expect(meta).toMatchObject({ role: 'DEBTOR', tenantId: 't1', debtorId: 'd1' });
  });
});
