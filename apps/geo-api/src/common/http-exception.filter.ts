import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status: (c: number) => { json: (b: unknown) => void } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';
    res.status(status).json({ error: { status, message, timestamp: new Date().toISOString() } });
  }
}
