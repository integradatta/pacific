import type { ReactNode } from 'react';
import Link from 'next/link';

/** Estado de erro padrão — painel com rótulo "sinal perdido" e mensagem na voz da interface. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="panel p-8 border-status-red/40" role="alert">
      <p className="font-mono text-[10px] text-status-red uppercase tracking-widest mb-1.5">sinal perdido</p>
      <p className="font-sans text-sm text-text-dim">{message}</p>
    </div>
  );
}

const ctaClass =
  'inline-flex items-center gap-2 bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:shadow-none transition-all';

type Action = { label: string; href: string } | { label: string; onClick: () => void; pending?: boolean };

/** Estado vazio padrão — convite à ação (CTA opcional), não apenas "sem dados". */
export function EmptyState({ glyph = '◌', title, hint, action }: { glyph?: string; title: string; hint?: ReactNode; action?: Action }) {
  return (
    <div className="panel p-12 text-center">
      <p className="font-mono text-2xl text-muted/60 mb-3" aria-hidden>
        {glyph}
      </p>
      <p className="font-sans text-sm text-text-dim">{title}</p>
      {hint ? <p className={`font-mono text-[10px] text-muted uppercase tracking-widest mt-1.5 ${action ? 'mb-5' : ''}`}>{hint}</p> : null}
      {action ? (
        'href' in action ? (
          <Link href={action.href} className={ctaClass}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} disabled={action.pending} className={ctaClass}>
            {action.pending ? 'Gerando…' : action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
