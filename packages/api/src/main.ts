import 'dotenv/config';
import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Headers de segurança. CSP off (API só serve JSON) e CORP cross-origin p/ não quebrar o web.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // CORS: em produção, WEB_ORIGIN é OBRIGATÓRIO (lista separada por vírgula). Nunca refletir
  // qualquer origem com credentials. Em dev, sem WEB_ORIGIN, libera (apenas local).
  const webOrigin = process.env.WEB_ORIGIN;
  if (process.env.NODE_ENV === 'production' && !webOrigin) {
    throw new Error('WEB_ORIGIN é obrigatório em produção (CORS) — defina a(s) origem(ns) do web.');
  }
  app.enableCors({ origin: webOrigin ? webOrigin.split(',').map((o) => o.trim()) : true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // O filtro global de exceções é registrado via APP_FILTER (DI) no AppModule p/ injetar o tracking.
  // Railway/Render injetam PORT; bind em 0.0.0.0 para o container aceitar tráfego externo.
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3333), '0.0.0.0');
}
void bootstrap();
