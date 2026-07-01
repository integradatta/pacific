'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCopilot, type CopilotAnswer } from '@/lib/hooks';
import { formatBRL, venceEm } from '@/lib/format';

// IA-1 — Copiloto da carteira: perguntas sugeridas (chips) → resposta pronta + lista clicável.
// Determinístico (servidor); sem LLM/custo. Cobre "quem cobrar hoje", "maiores riscos", "resumo".
const QUESTIONS = [
  { key: 'collectToday', label: 'Quem devo cobrar hoje?' },
  { key: 'topRisks', label: 'Quais clientes têm maior risco?' },
  { key: 'summary', label: 'Resuma minha carteira' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];

function probTone(p: number): string {
  return p >= 70 ? 'text-status-green' : p >= 40 ? 'text-status-yellow' : 'text-status-red';
}

export function Copilot() {
  const copilot = useCopilot();
  const [active, setActive] = useState<Key>('collectToday');
  const answer: CopilotAnswer | undefined = copilot.data?.[active];

  return (
    <section className="panel p-5" aria-label="Copiloto da carteira">
      <div className="flex items-center gap-2 mb-3">
        <span aria-hidden className="text-base">✦</span>
        <h2 className="font-display text-base font-semibold text-text tracking-tight">Copiloto</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">pergunte à sua carteira</span>
      </div>

      {/* Chips de perguntas */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUESTIONS.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => setActive(q.key)}
            aria-pressed={active === q.key}
            className={`font-mono text-[11px] tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
              active === q.key ? 'border-sonar/50 bg-sonar/10 text-sonar' : 'border-line bg-surface2 text-muted hover:text-text'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Resposta */}
      {copilot.isLoading ? (
        <div className="skeleton h-5 w-3/4 rounded" />
      ) : copilot.isError || !answer ? (
        <p className="font-sans text-sm text-text-dim">Não foi possível consultar agora.</p>
      ) : (
        <>
          <p className="font-sans text-sm text-text leading-relaxed">{answer.text}</p>
          {answer.rows.length > 0 && (
            <ul className="mt-3 divide-y divide-line/70 border-t border-line/70">
              {answer.rows.map((r) => (
                <li key={r.id} className="py-2.5">
                  <Link href={`/operacoes/${r.id}`} className="flex items-center justify-between gap-3 group">
                    <span className="font-sans text-sm text-text group-hover:text-sonar transition-colors truncate">{r.debtorName}</span>
                    <span className="flex items-center gap-3 shrink-0 font-mono text-xs tabular-nums">
                      <span className={probTone(r.paymentProbability)}>{r.paymentProbability}%</span>
                      <span className="text-muted w-24 text-right">{venceEm(r.daysRemaining)}</span>
                      <span className="text-text w-24 text-right">{formatBRL(r.amountDue)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
