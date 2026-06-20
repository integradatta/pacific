import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Portal web está em outra origem; sem CORS o navegador bloqueia as chamadas.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  // Railway/Render injetam PORT; bind em 0.0.0.0 para o container aceitar tráfego externo.
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3333), '0.0.0.0');
}
void bootstrap();
