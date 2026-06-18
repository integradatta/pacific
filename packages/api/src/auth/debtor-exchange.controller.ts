import { Body, Controller, Ip, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { IpRateLimitGuard } from './ip-rate-limit.guard.js';
import { DebtorExchangeService } from './debtor-exchange.service.js';

class ExchangeDto {
  @IsString() @MinLength(10) token!: string;
}

@Controller('auth')
export class DebtorExchangeController {
  constructor(private readonly exchange: DebtorExchangeService) {}

  @Post('debtor/exchange')
  @UseGuards(new IpRateLimitGuard())
  do(@Body() dto: ExchangeDto, @Ip() ip: string): Promise<{ token: string }> {
    return this.exchange.exchange(dto.token, ip);
  }
}
