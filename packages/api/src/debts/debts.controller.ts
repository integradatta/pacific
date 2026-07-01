import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { PaginationQuery, Page } from '../common/pagination.js';
import { DebtsService, type PaymentClaimRow } from './debts.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { PreviewDebtDto } from './dto/preview-debt.dto.js';
import { CreateQuickDebtDto } from './dto/create-quick-debt.dto.js';
import { UpdateDebtTagsDto } from './dto/update-debt-tags.dto.js';
import { UpdateDebtDatesDto } from './dto/update-debt-dates.dto.js';
import { PayDebtDto } from './dto/pay-debt.dto.js';
import { RenegotiateDebtDto } from './dto/renegotiate-debt.dto.js';
import type { Debt } from '@pacific/database';
import type { DebtSummary, DebtRecord, DebtEvent } from '@pacific/shared';

@Controller('debts')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  // Prévia (juros/score) — cálculo no servidor; o client não embarca o motor proprietário.
  @Post('preview') @Roles('CREDITOR')
  preview(@Body() dto: PreviewDebtDto) {
    return this.debts.preview(dto);
  }

  @Post() @Roles('CREDITOR')
  create(@TenantId() tenantId: string, @Body() dto: CreateDebtDto): Promise<Debt> {
    return this.debts.create(tenantId, dto);
  }

  // Cadastro simplificado: cria cliente + operação numa transação.
  @Post('quick') @Roles('CREDITOR')
  createQuick(
    @TenantId() tenantId: string,
    @Body() dto: CreateQuickDebtDto,
  ): Promise<{ debtorId: string; debtId: string }> {
    return this.debts.createQuick(tenantId, dto);
  }

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string, @Query() q: PaginationQuery): Promise<Page<Debt>> {
    return this.debts.list(tenantId, q);
  }

  // Pagamentos informados pelo sobrinho aguardando confirmação (declarado ANTES de :id).
  @Get('claims/pending') @Roles('CREDITOR')
  pendingClaims(@TenantId() tenantId: string): Promise<PaymentClaimRow[]> {
    return this.debts.pendingClaims(tenantId);
  }

  // Lixeira: operações excluídas (restauráveis por 30 dias). Declarado ANTES de :id.
  @Get('trash') @Roles('CREDITOR')
  trash(@TenantId() tenantId: string) {
    return this.debts.listTrash(tenantId);
  }

  @Post('claims/:id/confirm') @Roles('CREDITOR')
  confirmClaim(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.debts.confirmClaim(tenantId, id);
  }

  @Post('claims/:id/reject') @Roles('CREDITOR')
  rejectClaim(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.debts.rejectClaim(tenantId, id);
  }

  @Get(':id') @Roles('CREDITOR')
  get(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtRecord> {
    return this.debts.get(tenantId, id);
  }

  @Get(':id/summary') @Roles('CREDITOR')
  summary(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtSummary> {
    return this.debts.summary(tenantId, id);
  }

  @Get(':id/history') @Roles('CREDITOR')
  history(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtEvent[]> {
    return this.debts.history(tenantId, id);
  }

  @Patch(':id/tags') @Roles('CREDITOR')
  setTags(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtTagsDto,
  ): Promise<DebtRecord> {
    return this.debts.setTags(tenantId, id, dto.tags);
  }

  // Ajusta as datas (data inicial / vencimento) — permite registrar/corrigir dívidas antigas.
  @Patch(':id/dates') @Roles('CREDITOR')
  updateDates(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtDatesDto,
  ): Promise<DebtRecord> {
    return this.debts.updateDates(tenantId, id, dto);
  }

  // Registra pagamento (parcial: { amount } ou total: { full: true }).
  @Post(':id/payments') @Roles('CREDITOR')
  pay(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: PayDebtDto): Promise<DebtRecord> {
    return this.debts.pay(tenantId, id, dto);
  }

  // Renegocia (refaz o acordo): novo vencimento e, opcionalmente, nova taxa.
  @Post(':id/renegotiate') @Roles('CREDITOR')
  renegotiate(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: RenegotiateDebtDto): Promise<DebtRecord> {
    return this.debts.renegotiate(tenantId, id, dto);
  }

  // Restaura uma operação da lixeira.
  @Post(':id/restore') @Roles('CREDITOR')
  restore(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.debts.restore(tenantId, id);
  }

  // Move a operação para a lixeira (soft-delete; restaurável por 30 dias).
  @Delete(':id') @Roles('CREDITOR')
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.debts.remove(tenantId, id);
  }
}
