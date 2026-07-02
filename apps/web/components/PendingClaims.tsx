'use client';

import { useState } from 'react';
import { useConfirmClaim, useRejectClaim, type PaymentClaimRow } from '@/lib/debts';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/Toast';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Banner de pagamentos informados pelos sobrinhos aguardando confirmação do padrinho.
// Confirmar (valor informado), Ajustar (ex.: avisou 500, caiu 480) ou Recusar. Some quando vazio.
// As linhas vêm do payload agregado do dashboard (/dashboard/home) — sem chamada própria.
export function PendingClaims({ rows }: { rows: PaymentClaimRow[] }) {
  const confirm = useConfirmClaim();
  const reject = useRejectClaim();
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  if (rows.length === 0) return null;

  function doConfirm(id: string, adjusted?: string) {
    confirm.mutate(
      { id, amount: adjusted },
      { onSuccess: () => { setEditing(null); toast(adjusted ? 'Pagamento confirmado (ajustado).' : 'Pagamento confirmado e registrado.', 'success'); }, onError: () => toast('Não foi possível confirmar.', 'error') },
    );
  }
  function doReject(id: string, name: string) {
    if (!window.confirm(`Recusar o pagamento informado por ${name}? O sobrinho será avisado de que não bateu.`)) return;
    reject.mutate(id, { onSuccess: () => toast('Pagamento recusado.', 'info'), onError: () => toast('Não foi possível recusar.', 'error') });
  }

  const busy = confirm.isPending || reject.isPending;
  const btn = 'font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 disabled:opacity-50 transition-colors';
  return (
    <section className="panel overflow-hidden border-status-yellow/40">
      <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-text tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-yellow animate-ping2" /> Pagamentos a confirmar
        </h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length}</span>
      </div>
      <ul className="divide-y divide-line/70">
        {rows.map((c) => (
          <li key={c.id} className="px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-sans text-sm text-text">
                <span className="font-medium">{c.debtorName}</span> informou{' '}
                <span className="font-mono text-text tabular-nums">{formatBRL(c.amount)}</span>
              </p>
              <p className="font-mono text-[11px] text-muted tabular-nums">{fmtDate(c.claimedAt)}{c.note ? ` · ${c.note}` : ''}</p>
            </div>
            {editing === c.id ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted">R$</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                    className="w-24 bg-surface2 border border-line rounded pl-7 pr-2 py-1 font-mono text-xs text-text tabular-nums focus:outline-none focus:border-sonar" />
                </div>
                <button type="button" disabled={busy || !(Number(amount) > 0)} onClick={() => doConfirm(c.id, amount)} className={`${btn} text-status-green border-status-green/40 hover:bg-status-green/10`}>Confirmar</button>
                <button type="button" onClick={() => setEditing(null)} className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-text px-1">Cancelar</button>
              </div>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button type="button" disabled={busy} onClick={() => doConfirm(c.id)} className={`${btn} text-status-green border-status-green/40 hover:bg-status-green/10`}>Confirmar</button>
                <button type="button" disabled={busy} onClick={() => { setEditing(c.id); setAmount(c.amount); }} className={`${btn} text-sonar border-sonar/40 hover:bg-sonar/10`}>Ajustar</button>
                <button type="button" disabled={busy} onClick={() => doReject(c.id, c.debtorName)} className={`${btn} text-status-red border-status-red/40 hover:bg-status-red/10`}>Recusar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
