import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// Liveness público p/ monitores de uptime / load balancer. Leve (sem tocar o banco).
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; at: string } {
    return { status: 'ok', at: new Date().toISOString() };
  }
}
