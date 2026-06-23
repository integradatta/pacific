import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter.js';

function host(): { host: ArgumentsHost; res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } } {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const req = { method: 'POST', path: '/debts', ip: '203.0.113.1' };
  const h = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) } as unknown as ArgumentsHost;
  return { host: h, res };
}

describe('AllExceptionsFilter', () => {
  it('registra ERROR no tracking para 5xx (erro não-HTTP)', () => {
    const tracking = { recordRaw: vi.fn(async () => {}) };
    const { host: h, res } = host();
    new AllExceptionsFilter(tracking as never).catch(new Error('boom'), h);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(tracking.recordRaw).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ERROR', actorType: 'SYSTEM', targetId: 'POST /debts' }),
    );
  });

  it('NÃO registra para 4xx (erro de cliente)', () => {
    const tracking = { recordRaw: vi.fn(async () => {}) };
    const { host: h, res } = host();
    new AllExceptionsFilter(tracking as never).catch(new BadRequestException('ruim'), h);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(tracking.recordRaw).not.toHaveBeenCalled();
  });

  it('funciona sem tracking injetado (não lança)', () => {
    const { host: h, res } = host();
    expect(() => new AllExceptionsFilter().catch(new Error('x'), h)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
