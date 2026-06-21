'use client';

import { useState, type FormEvent } from 'react';
import { Shell } from '@/components/Shell';
import { useDebtors, useDebtorMutations } from '@/lib/debtors';
import { LocationPanel } from '@/components/LocationPanel';

function LinkReveal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-sonar/5 border border-sonar/40 rounded-lg p-4 space-y-2">
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
          className="bg-sonar text-ink font-mono text-xs font-medium uppercase tracking-widest px-4 rounded hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar"
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
        <section className="bg-surface border border-line rounded-xl p-5">
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
                className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar"
              />
            </div>
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="bg-sonar text-ink font-mono text-sm font-medium uppercase tracking-widest py-2.5 px-5 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted animate-pulse">Carregando…</p>
          </div>
        ) : list.isError ? (
          <div className="bg-surface border border-status-red/40 rounded-xl p-8" role="alert">
            <p className="font-mono text-sm text-status-red">Não foi possível carregar os devedores.</p>
          </div>
        ) : (list.data?.items ?? []).length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted">Nenhum devedor cadastrado. Cadastre o primeiro acima.</p>
          </div>
        ) : (
          <section className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold text-text tracking-tight">Devedores</h2>
              <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{list.data?.total} no total</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="font-mono text-[10px] text-muted uppercase tracking-widest">
                  <th className="text-left font-normal px-6 py-2">Devedor</th>
                  <th className="text-left font-normal px-6 py-2">Status</th>
                  <th className="text-left font-normal px-6 py-2">Último acesso</th>
                  <th className="text-right font-normal px-6 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-line">
                    <td className="px-6 py-3 font-sans text-sm text-text">{d.name}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
                        <span className={`w-2 h-2 rounded-full ${d.active ? 'bg-status-green' : 'bg-status-red'}`} />
                        {d.active ? 'ativo' : 'revogado'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-muted tabular-nums">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('pt-BR') : 'nunca entrou'}
                    </td>
                    <td className="px-6 py-3">
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
