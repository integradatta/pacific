'use client';

import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { useDebtors, useDebtorMutations } from '@/lib/debtors';
import { LocationPanel } from '@/components/LocationPanel';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';

function LinkReveal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-sonar/[0.07] border border-sonar/40 rounded-lg p-4 space-y-2 shadow-[inset_0_0_24px_-12px_rgb(var(--sonar)/0.6)]">
      <p className="font-mono text-[10px] text-sonar uppercase tracking-widest">
        Link de acesso — copie e envie agora (mostrado uma única vez)
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-ink border border-line rounded px-3 py-2 font-mono text-xs text-text"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(link);
            setCopied(true);
          }}
          className="bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest px-4 rounded hover:brightness-110 active:translate-y-px transition-all"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <button type="button" onClick={onClose} className="font-mono text-[10px] text-muted hover:text-text">
        fechar
      </button>
    </div>
  );
}

export default function DevedoresPage() {
  const list = useDebtors();
  // Sobrinhos são criados junto da operação (Nova Ajuda → /debts/quick). Aqui só geramos/rotacionamos
  // o link de acesso de um sobrinho que JÁ existe — nunca criar sobrinho avulso (evita duplicatas sem dívida).
  const { rotate, revoke, reactivate } = useDebtorMutations();
  const [reveal, setReveal] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRotate(id: string): Promise<void> {
    setBusyId(id);
    try {
      const out = await rotate.mutateAsync(id);
      setReveal(out.accessLink);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(id: string, active: boolean): Promise<void> {
    setBusyId(id);
    try {
      await (active ? revoke : reactivate).mutateAsync(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell title="Sobrinhos">
      <div className="space-y-6 max-w-4xl">
        {reveal && (
          <section className="panel p-5">
            <LinkReveal link={reveal} onClose={() => setReveal(null)} />
          </section>
        )}

        {list.isLoading ? (
          <ListSkeleton />
        ) : list.isError ? (
          <ErrorState message="Não foi possível carregar os sobrinhos." />
        ) : (list.data?.items ?? []).length === 0 ? (
          <EmptyState glyph="◍" title="Nenhum sobrinho ainda." hint="cadastre uma operação em Nova Ajuda — o sobrinho é criado junto e aparece aqui para gerar o link" />
        ) : (
          <section className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold text-text tracking-tight">Sobrinhos</h2>
              <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{list.data?.total} no total</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                  <th className="text-left font-normal px-6 py-2.5">Sobrinho</th>
                  <th className="text-left font-normal px-6 py-2.5">Status</th>
                  <th className="text-left font-normal px-6 py-2.5">Último acesso</th>
                  <th className="text-right font-normal px-6 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-line/70 hover:bg-sonar/[0.03] transition-colors">
                    <td className="px-6 py-3.5 font-sans text-sm text-text">{d.name}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
                        <span className={`w-2 h-2 rounded-full ${d.active ? 'bg-status-green' : 'bg-status-red'}`} />
                        {d.active ? 'ativo' : 'revogado'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-muted tabular-nums">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('pt-BR') : 'nunca entrou'}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => void handleRotate(d.id)}
                          className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-sonar border border-line hover:border-sonar rounded px-2.5 py-1.5 disabled:opacity-50"
                        >
                          Novo link
                        </button>
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => void handleToggle(d.id, d.active)}
                          className={`font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1.5 disabled:opacity-50 ${
                            d.active
                              ? 'text-status-red border-status-red/40 hover:bg-status-red/10'
                              : 'text-status-green border-status-green/40 hover:bg-status-green/10'
                          }`}
                        >
                          {d.active ? 'Revogar' : 'Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        <LocationPanel />
      </div>
    </Shell>
  );
}
