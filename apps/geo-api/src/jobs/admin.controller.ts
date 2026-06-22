import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { JobsService } from './jobs.service.js';

// Monitoramento de storage do free tier (spec §1.5).
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly jobs: JobsService) {}

  @Get('storage-status')
  storageStatus() {
    return this.jobs.storageStatus();
  }
}
