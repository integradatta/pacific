import { describe, it, expect, vi } from 'vitest';
import { PublicEventsController } from './events.controller.js';

describe('PublicEventsController.loginFailed', () => {
  it('registra LOGIN_FAILED com e-mail normalizado + ip', async () => {
    const tracking = { recordRaw: vi.fn(async () => {}) };
    const ctrl = new PublicEventsController(tracking as never);
    await ctrl.loginFailed({ email: 'Credor@Empresa.com' }, '203.0.113.7');
    expect(tracking.recordRaw).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOGIN_FAILED', actorType: 'CREDITOR', actorId: 'credor@empresa.com', ip: '203.0.113.7' }),
    );
  });

  it('descarta (silenciosamente) acima do limite de throttle por IP', async () => {
    const tracking = { recordRaw: vi.fn(async () => {}) };
    const ctrl = new PublicEventsController(tracking as never);
    for (let i = 0; i < 25; i++) await ctrl.loginFailed({ email: 'x@y.com' }, '198.51.100.9');
    // limite=20 na janela; alguns dos 25 são descartados → menos chamadas que tentativas.
    expect(tracking.recordRaw.mock.calls.length).toBeLessThan(25);
  });
});
