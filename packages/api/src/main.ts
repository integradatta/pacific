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
  // Portal web está em outra origem; sem CORS o navegador bloqueia as chamadas.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // O filtro global de exceções é registrado via APP_FILTER (DI) no AppModule p/ injetar o tracking.
  // Railway/Render injetam PORT; bind em 0.0.0.0 para o container aceitar tráfego externo.
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3333), '0.0.0.0');
}
void bootstrap();
