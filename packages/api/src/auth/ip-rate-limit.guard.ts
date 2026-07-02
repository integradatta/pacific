import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket { count: number; resetAt: number; }

@Injectable()
export class IpRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, Bucket>();
  private lastSweep = Date.now();
  constructor(
    private readonly limit = Number(process.env.REDEEM_RATE_LIMIT ?? 10),
    private readonly windowMs = Number(process.env.REDEEM_RATE_WINDOW_MS ?? 600_000),
  ) {}
  // Expurgo preguiçoso: no máx. 1×/janela, remove buckets expirados. Sem isso o Map cresce sem limite
  // (vazamento lento, por réplica) — cada IP novo deixaria uma chave para sempre.
  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [k, b] of this.hits) if (b.resetAt < now) this.hits.delete(k);
  }
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ ip?: string }>();
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    this.sweep(now);
    const b = this.hits.get(key);
    if (!b || b.resetAt < now) { this.hits.set(key, { count: 1, resetAt: now + this.windowMs }); return true; }
    if (b.count >= this.limit) throw new HttpException('Muitas tentativas', HttpStatus.TOO_MANY_REQUESTS);
    b.count++;
    return true;
  }
}
