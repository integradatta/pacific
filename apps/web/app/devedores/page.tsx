'use client';

import { useState, type FormEvent } from 'react';
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
  const { create, rotate, revoke, reactivate } = useDebtorMutations();
  const [name, setName] = useState('');
  const [reveal, setReveal] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    const out = await create.mutateAsync(name.trim());
    setReveal(out.accessLink);
    setName('');
  }

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
    <Shell title="Devedores">
      <div className="space-y-6 max-w-4xl">
        <section className="panel p-5">
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="name" className="block font-mono text-[10px] text-muted uppercase tracking-widest mb-1">
                Cadastrar devedor
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nome do devedor"
                className="w-full bg-surface2 border border-line rounded-lg px-3.5 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-sonar focus:shadow-glow transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="bg-sonar text-ink font-mono text-sm font-semibold uppercase tracking-widest py-2.5 px-5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              {create.isPending ? 'Gerando…' : 'Gerar link'}
            </button>
          </form>
          {reveal && (
            <div className="mt-4">
              <LinkReveal link={reveal} onClose={() => setReveal(null)} />
            </div>
          )}
        </section>

        {list.isLoading ? (
          <ListSkeleton />
        ) : list.isError ? (
          <ErrorState message="Não foi possível carregar os devedores." />
        ) : (list.data?.items ?? []).length === 0 ? (
          <EmptyState glyph="◍" title="Nenhum devedor cadastrado." hint="cadastre o primeiro acima para gerar um link de acesso" />
        ) : (
          <section className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold text-text tracking-tight">Devedores</h2>
              <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{list.data?.total} no total</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                  <th className="text-left font-normal px-6 py-2.5">Devedor</th>
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
          </section>
        )}

        <LocationPanel />
      </div>
    </Shell>
  );
}
