import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from '../tracking/tracking.service.js';
import { captureException } from './sentry.js';
import { sanitizeForLog } from './log-sanitize.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');
  // @Optional: funciona sem tracking (testes/uso manual). Em produção o Nest injeta via APP_FILTER.
  constructor(@Optional() private readonly tracking?: TrackingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // Monitoramento: registra erros do servidor (5xx) no log estruturado + Sentry (stack trace) +
    // log de eventos. Detalhes passam por sanitizeForLog (nunca vazar senha/token/PII no log).
    // Best-effort, nunca relança.
    if (status >= 500) {
      const route = `${req?.method ?? ''} ${req?.path ?? req?.url ?? ''}`.trim() || undefined;
      const requestId = (res.getHeader?.('x-request-id') as string | undefined) ?? undefined;
      this.log.error(JSON.stringify(sanitizeForLog({
        action: 'http.error', route, status, requestId,
        error: { name: exception instanceof Error ? exception.name : 'Error', message: exception instanceof Error ? exception.message : String(message) },
      })));
      captureException(exception, { route, status, requestId });
      if (this.tracking) {
        void this.tracking.recordRaw({
          actorType: 'SYSTEM',
          type: 'ERROR',
          targetType: 'http',
          targetId: route,
          detail: sanitizeForLog({ message: exception instanceof Error ? exception.message : String(message), requestId }),
          ip: req?.ip,
        });
      }
    }

    res.status(status).json({ error: { status, message, timestamp: new Date().toISOString() } });
  }
}
