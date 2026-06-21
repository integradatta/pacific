'use client';

import { useState, type KeyboardEvent } from 'react';
import { normalizeTags, TAG_MAX_COUNT } from '@pacific/shared';

/** Chip de etiqueta (somente leitura). */
export function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-line bg-surface2 text-text-dim">
      {label}
    </span>
  );
}

/** Lista de chips; nada renderiza se vazia. */
export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {tags.map((t) => (
        <TagChip key={t} label={t} />
      ))}
    </span>
  );
}

/**
 * Editor de etiquetas controlado: adiciona ao pressionar Enter ou vírgula, remove no chip.
 * Normaliza com as mesmas regras do servidor; respeita o limite de quantidade.
 */
export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const full = value.length >= TAG_MAX_COUNT;

  function commit(raw: string): void {
    const next = normalizeTags([...value, raw]);
    if (next.length !== value.length) onChange(next);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-surface2 border border-line rounded-lg px-2.5 py-2 focus-within:border-sonar focus-within:shadow-glow transition-all">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-sonar/40 bg-sonar/[0.07] text-text"
        >
          {t}
          <button
            type="button"
            aria-label={`Remover ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-muted hover:text-status-red leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
        disabled={full}
        placeholder={full ? `máx. ${TAG_MAX_COUNT}` : value.length ? 'adicionar…' : 'ex.: negociando, judicial'}
        aria-label="Adicionar etiqueta"
        className="flex-1 min-w-24 bg-transparent text-text font-sans text-sm placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
