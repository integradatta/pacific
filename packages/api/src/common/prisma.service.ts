import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@pacific/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> { await this.$connect(); }
}
