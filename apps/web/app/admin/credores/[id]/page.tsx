'use client';

import Link from 'next/link';
import { Decimal } from 'decimal.js';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge, KpiCard } from '@/components/admin/ui';
import { useTenantOperations } from '@/lib/admin';
import { formatBRL, venceEm } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/status';

export default function CreditorOperationsPage({ params }: { params: { id: string } }) {
  const ops = useTenantOperations(params.id);
  const rows = ops.data ?? [];

  // Resumo da carteira deste padrinho (somas simples — não é o motor proprietário).
  const open = rows.filter((r) => !r.settled);
  const totalLent = rows.reduce((a, r) => a.plus(r.principal), new Decimal(0));
  const receivable = open.reduce((a, r) => a.plus(r.amountDue), new Decimal(0));
  const overdue = open.filter((r) => r.status === 'RED').reduce((a, r) => a.plus(r.amountDue), new Decimal(0));
  const settledCount = rows.filter((r) => r.settled).length;

  return (
    <AdminShell title="Operações do padrinho">
      <div className="space-y-4">
        <Link href="/admin/credores" className="inline-block font-mono text-[11px] text-muted hover:text-iris uppercase tracking-widest">← Padrinhos</Link>

        {/* Resumo financeiro da carteira do padrinho */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Operações" value={String(rows.length)} sub={settledCount > 0 ? `${settledCount} quitadas` : ''} tone="iris" />
          <KpiCard label="Total investido" value={formatBRL(totalLent.toFixed(2))} />
          <KpiCard label="A receber" value={formatBRL(receivable.toFixed(2))} />
          <KpiCard label="Vencido" value={formatBRL(overdue.toFixed(2))} tone={overdue.gt(0) ? 'red' : undefined} />
        </div>

        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-text tracking-tight">Carteira</h2>
            <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length} operações</span>
          </div>
          {ops.isError ? (
            <p className="px-6 py-4 font-mono text-sm text-status-red">Não foi possível carregar (a API não está acessível ou a carteira está vazia).</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                  <th className="text-left font-normal px-6 py-2.5">Sobrinho</th>
                  <th className="text-right font-normal px-6 py-2.5">Devido</th>
                  <th className="text-right font-normal px-6 py-2.5">Vence</th>
                  <th className="text-left font-normal px-6 py-2.5">Etiquetas</th>
                  <th className="text-left font-normal px-6 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line/70">
                    <td className="px-6 py-3 font-sans text-sm text-text">{r.debtorName}</td>
                    <td className="px-6 py-3 font-mono text-sm text-text text-right tabular-nums">{formatBRL(r.amountDue)}</td>
                    <td className="px-6 py-3 font-mono text-sm text-muted text-right tabular-nums">{r.settled ? '—' : venceEm(r.daysRemaining)}</td>
                    <td className="px-6 py-3"><span className="flex gap-1 flex-wrap">{r.tags.map((t) => <AdminBadge key={t} tone="muted">{t}</AdminBadge>)}</span></td>
                    <td className="px-6 py-3 font-mono text-xs text-muted">{r.settled ? 'pago' : STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
                {rows.length === 0 && !ops.isError && <tr><td colSpan={5} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{ops.isLoading ? 'Carregando…' : 'Nenhuma operação nesta carteira.'}</td></tr>}
              </tbody>
            </table>
          )}
        </section>

        <p className="font-mono text-[10px] text-muted tracking-wider">
          Auditoria e acessos deste padrinho em <Link href="/admin/auditoria" className="text-iris">Auditoria</Link> e <Link href="/admin/monitoramento" className="text-iris">Monitoramento</Link>.
        </p>
      </div>
    </AdminShell>
  );
}
