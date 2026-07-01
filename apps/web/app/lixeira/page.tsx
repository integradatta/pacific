'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useTrash, useRestoreDebt } from '@/lib/debts';
import { formatBRL } from '@/lib/format';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';
import { toast } from '@/components/Toast';

// Dias restantes até a depuração definitiva (30 dias após a exclusão).
function daysLeft(deletedAt: string): number {
  const purge = new Date(deletedAt).getTime() + 30 * 86_400_000;
  return Math.max(0, Math.ceil((purge - Date.now()) / 86_400_000));
}

export default function LixeiraPage() {
  const trash = useTrash();
  const restore = useRestoreDebt();
  const rows = trash.data ?? [];

  function doRestore(id: string, name: string) {
    restore.mutate(id, {
      onSuccess: () => toast(`Operação de ${name} restaurada.`, 'success'),
      onError: () => toast('Não foi possível restaurar.', 'error'),
    });
  }

  return (
    <Shell title="Lixeira">
      <div className="max-w-3xl space-y-4">
        <Link href="/configuracoes" className="inline-block font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest">← Configurações</Link>
        <p className="font-sans text-sm text-text-dim">
          Operações excluídas ficam aqui por <span className="text-text">30 dias</span> e podem ser restauradas. Depois disso são removidas em definitivo.
        </p>

        {trash.isLoading ? (
          <ListSkeleton rows={3} />
        ) : trash.isError ? (
          <ErrorState message="Não foi possível carregar a lixeira." />
        ) : rows.length === 0 ? (
          <EmptyState glyph="🗑" title="Lixeira vazia." hint="operações que você excluir aparecem aqui por 30 dias" />
        ) : (
          <section className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                    <th className="text-left font-normal px-6 py-2.5">Sobrinho</th>
                    <th className="text-right font-normal px-6 py-2.5">Valor</th>
                    <th className="text-right font-normal px-6 py-2.5">Excluída</th>
                    <th className="text-right font-normal px-6 py-2.5">Some em</th>
                    <th className="text-right font-normal px-6 py-2.5">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line/70">
                      <td className="px-6 py-3 font-sans text-sm text-text">{r.debtorName}</td>
                      <td className="px-6 py-3 font-mono text-sm text-text-dim text-right tabular-nums">{formatBRL(r.principal)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-muted text-right tabular-nums">{new Date(r.deletedAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-3 font-mono text-xs text-right tabular-nums"><span className={daysLeft(r.deletedAt) <= 5 ? 'text-status-red' : 'text-muted'}>{daysLeft(r.deletedAt)} dias</span></td>
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button" disabled={restore.isPending} onClick={() => doRestore(r.id, r.debtorName)}
                          className="font-mono text-[10px] uppercase tracking-widest text-sonar border border-sonar/40 rounded px-2.5 py-1 hover:bg-sonar/10 disabled:opacity-50 transition-colors"
                        >
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}
