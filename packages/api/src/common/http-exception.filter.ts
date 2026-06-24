import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from '../tracking/tracking.service.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // @Optional: funciona sem tracking (testes/uso manual). Em produção o Nest injeta via APP_FILTER.
  constructor(@Optional() private readonly tracking?: TrackingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // Monitoramento: registra erros do servidor (5xx) no log de eventos. Best-effort, nunca relança.
    if (status >= 500 && this.tracking) {
      void this.tracking.recordRaw({
        actorType: 'SYSTEM',
        type: 'ERROR',
        targetType: 'http',
        targetId: `${req?.method ?? ''} ${req?.path ?? req?.url ?? ''}`.trim() || undefined,
        detail: { message: exception instanceof Error ? exception.message : String(message) },
        ip: req?.ip,
      });
    }

    res.status(status).json({ error: { status, message, timestamp: new Date().toISOString() } });
  }
}
