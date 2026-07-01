import 'dotenv/config';
import 'reflect-metadata';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { initSentry } from './common/sentry.js';

async function bootstrap(): Promise<void> {
  // Observabilidade: inicia o Sentry o mais cedo possível (no-op sem SENTRY_DSN).
  initSentry();
  // bodyParser próprio com LIMITE de tamanho — mitiga DoS por payload grande/aninhado
  // (body-parser/qs/express). 100kb cobre os payloads JSON da API com folga.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));
  // Atrás do proxy do Railway/Vercel: confia no 1º hop p/ obter o IP real do cliente
  // (X-Forwarded-For) — essencial p/ o rate limiting por IP não tratar todos como um só.
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set('trust proxy', 1);
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
