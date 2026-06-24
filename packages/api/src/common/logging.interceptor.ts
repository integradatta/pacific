import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Log estruturado por requisição (método, rota, status, duração). Fundação de observabilidade:
 * a saída em JSON é fácil de coletar/agregar (métricas, tracing, alertas) sem mudar o app depois.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl ?? req.url;
    if (url.startsWith('/health')) return next.handle(); // monitores: não polui o log
    const done = () => {
      const status = ctx.switchToHttp().getResponse<Response>().statusCode;
      this.log.log(JSON.stringify({ method, url, status, ms: Date.now() - start }));
    };
    return next.handle().pipe(tap({ next: done, error: done }));
  }
}
