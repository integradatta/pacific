import { describe, it, expect, vi } from 'vitest';
import { TenantScopedService } from './tenant-scoped.service.js';

describe('TenantScopedService.withTenant', () => {
  it('define app.current_tenant (set_config) ANTES de executar fn, dentro de uma transação', async () => {
    const order: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async (..._args: unknown[]) => {
        order.push('set_config');
        return [];
      }),
      debt: {
        findMany: vi.fn(async () => {
          order.push('query');
          return [];
        }),
      },
    };
    const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const resolver = { forTenant: () => prisma } as never;

    const scoped = new TenantScopedService(resolver);
    const out = await scoped.withTenant('tenant-1', async (t) => {
      await (t as unknown as typeof tx).debt.findMany();
      return 'ok';
    });

    expect(out).toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    // tenantId é passado como parâmetro do template (set_config('app.current_tenant', $1, true)).
    expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe('tenant-1');
    expect(order).toEqual(['set_config', 'query']);
  });
});
