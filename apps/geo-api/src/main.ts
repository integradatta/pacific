import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(Number(process.env.PORT ?? 3334), '0.0.0.0');
}
void bootstrap();
