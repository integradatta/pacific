import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service.js';

// Liveness público p/ monitores de uptime / load balancer. Leve (sem tocar o banco).
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): { status: string; at: string } {
    return { status: 'ok', at: new Date().toISOString() };
  }

  // Readiness: confirma que o banco responde. 503 se indisponível (o LB pode tirar de rotação).
  @Get('ready')
  async ready(): Promise<{ status: string; at: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('banco indisponível');
    }
    return { status: 'ready', at: new Date().toISOString() };
  }
}
