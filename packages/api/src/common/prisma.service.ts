import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@pacific/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> { await this.$connect(); }
  // Desconexão limpa no shutdown (SIGTERM em deploy/restart do Railway) — evita conexões penduradas.
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
