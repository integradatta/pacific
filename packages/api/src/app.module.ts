import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';

@Module({ providers: [PrismaService], exports: [PrismaService] })
export class AppModule {}
