import { Body, Controller, Post } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';
import { RegisterCreditorDto } from './dto/register-creditor.dto.js';

@Controller('auth')
export class CreditorsController {
  constructor(private readonly creditors: CreditorsService) {}
  @Post('register-creditor')
  register(@Body() dto: RegisterCreditorDto): Promise<{ tenantId: string; orgCode: string }> {
    return this.creditors.register(dto);
  }
}
