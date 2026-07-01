'use client';

import { usePendingClaims, useConfirmClaim, useRejectClaim } from '@/lib/debts';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/Toast';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Banner de pagamentos informados pelos sobrinhos aguardando confirmação do padrinho.
// Só aparece quando há pendências (não polui o dashboard quando está vazio).
export function PendingClaims() {
  const claims = usePendingClaims();
  const confirm = useConfirmClaim();
  const reject = useRejectClaim();
  const rows = claims.data ?? [];
  if (rows.length === 0) return null;

  function doConfirm(id: string, name: string) {
    if (!window.confirm(`Confirmar o pagamento informado por ${name}? Ele será registrado na operação.`)) return;
    confirm.mutate(id, {
      onSuccess: () => toast('Pagamento confirmado e registrado.', 'success'),
      onError: () => toast('Não foi possível confirmar.', 'error'),
    });
  }
  function doReject(id: string, name: string) {
    if (!window.confirm(`Recusar o pagamento informado por ${name}? Nada é registrado na operação.`)) return;
    reject.mutate(id, {
      onSuccess: () => toast('Pagamento recusado.', 'info'),
      onError: () => toast('Não foi possível recusar.', 'error'),
    });
  }

  const busy = confirm.isPending || reject.isPending;
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
              <p className="font-mono text-[11px] text-muted tabular-nums">
                {fmtDate(c.claimedAt)}{c.note ? ` · ${c.note}` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button" disabled={busy} onClick={() => doConfirm(c.id, c.debtorName)}
                className="font-mono text-[10px] uppercase tracking-widest text-status-green border border-status-green/40 rounded px-2.5 py-1 hover:bg-status-green/10 disabled:opacity-50 transition-colors"
              >
                Confirmar
              </button>
              <button
                type="button" disabled={busy} onClick={() => doReject(c.id, c.debtorName)}
                className="font-mono text-[10px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-2.5 py-1 hover:bg-status-red/10 disabled:opacity-50 transition-colors"
              >
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
