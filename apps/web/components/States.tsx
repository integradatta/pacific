import type { ReactNode } from 'react';

/** Estado de erro padrão — painel com rótulo "sinal perdido" e mensagem na voz da interface. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="panel p-8 border-status-red/40" role="alert">
      <p className="font-mono text-[10px] text-status-red uppercase tracking-widest mb-1.5">sinal perdido</p>
      <p className="font-sans text-sm text-text-dim">{message}</p>
    </div>
  );
}

/** Estado vazio padrão — convite à ação, não apenas "sem dados". */
export function EmptyState({ glyph = '◌', title, hint }: { glyph?: string; title: string; hint?: ReactNode }) {
  return (
    <div className="panel p-12 text-center">
      <p className="font-mono text-2xl text-muted/60 mb-3" aria-hidden>
        {glyph}
      </p>
      <p className="font-sans text-sm text-text-dim">{title}</p>
      {hint ? <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-1.5">{hint}</p> : null}
    </div>
  );
}
