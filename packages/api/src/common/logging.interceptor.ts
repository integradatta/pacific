import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Log estruturado por requisição (método, rota, status, duração, requestId). Fundação de
 * observabilidade: saída em JSON fácil de coletar/agregar. O requestId é gerado aqui (ou herdado do
 * header x-request-id do proxy), vai no log e volta na RESPOSTA — permite rastrear o fluxo completo
 * de uma requisição entre o log HTTP, o log de erro e o Sentry.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl ?? req.url;
    if (url.startsWith('/health')) return next.handle(); // monitores: não polui o log
    // Herda o id do proxy (se injetado) ou gera um curto.
    const requestId = (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) || randomUUID().slice(0, 13);
    if (!res.headersSent) res.setHeader('x-request-id', requestId);
    const done = () => {
      this.log.log(JSON.stringify({ method, url, status: res.statusCode, ms: Date.now() - start, requestId }));
    };
    return next.handle().pipe(tap({ next: done, error: done }));
  }
}
