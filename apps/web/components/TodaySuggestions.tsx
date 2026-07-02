'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuggestions, type Suggestion } from '@/lib/insights';

// #1 "Hoje" — SUGESTÕES gentis (nunca ordens), compactas e dispensáveis por dia. Mobile-harmônico.
const ACCENT: Record<Suggestion['kind'], string> = {
  support: 'var(--status-red)',
  claim: 'var(--sonar)',
  cooling: 'var(--iris)',
  overdue: 'var(--status-red)',
  due_soon: 'var(--sonar)',
  intent: 'var(--status-green)',
};

function dismissKey(): string {
  return `pacific_sugg_dismissed_${new Date().toISOString().slice(0, 10)}`;
}

export function TodaySuggestions() {
  const q = useSuggestions();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey());
      if (raw) setDismissed(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = [...prev, id];
      try { localStorage.setItem(dismissKey(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const items = (q.data ?? []).filter((s) => !dismissed.includes(s.id));
  if (q.isLoading || items.length === 0) return null; // some quietamente quando não há nada

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-base font-semibold text-text tracking-tight">Sugestões de hoje</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">opcional</span>
      </div>
      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="panel p-4 flex items-start gap-3" style={{ borderLeft: `2px solid rgb(${ACCENT[s.kind]} / 0.6)` }}>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-sm text-text">{s.title}</p>
              <p className="font-sans text-xs text-text-dim mt-0.5 leading-relaxed">{s.body}</p>
              {s.href && <Link href={s.href} className="inline-block font-mono text-[10px] text-sonar uppercase tracking-widest mt-2 hover:underline">ver →</Link>}
            </div>
            <button type="button" onClick={() => dismiss(s.id)} aria-label="Dispensar sugestão" className="font-mono text-xs text-muted hover:text-text shrink-0 leading-none mt-0.5">✕</button>
          </div>
        ))}
      </div>
    </section>
  );
}
