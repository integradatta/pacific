'use client';

import { useState, type KeyboardEvent } from 'react';
import { normalizeTags, TAG_MAX_COUNT, RISK_PRESETS } from '@pacific/shared';
import { RISK_META } from './RiskBadge';

const PRESET_TAGS = new Set(RISK_PRESETS.map((p) => p.tag));

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
 * Editor de etiquetas controlado. Duas partes:
 *  1) Classificação PRONTA (RISK_PRESETS): 3 etiquetas de risco mutuamente exclusivas — o padrinho
 *     só clica; a escolhida define o risco da operação (ver effectiveRisk/RiskBadge).
 *  2) Etiquetas livres: adiciona no Enter/vírgula, remove no chip. Normaliza como o servidor.
 */
export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const full = value.length >= TAG_MAX_COUNT;
  const custom = value.filter((t) => !PRESET_TAGS.has(t)); // chips livres (presets viram botões)

  function commit(raw: string): void {
    const next = normalizeTags([...value, raw]);
    if (next.length !== value.length) onChange(next);
    setDraft('');
  }

  // Presets são mutuamente exclusivos: escolher um remove o outro; clicar no ativo desmarca.
  function togglePreset(tag: string): void {
    if (value.includes(tag)) onChange(value.filter((v) => v !== tag));
    else onChange(normalizeTags([...value.filter((v) => !PRESET_TAGS.has(v)), tag]));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && custom.length > 0) {
      const last = custom[custom.length - 1];
      onChange(value.filter((v) => v !== last));
    }
  }

  return (
    <div className="space-y-2">
      {/* Classificação pronta (define o risco) */}
      <div className="flex flex-wrap gap-1.5">
        {RISK_PRESETS.map((p) => {
          const active = value.includes(p.tag);
          const meta = RISK_META[p.risk];
          return (
            <button
              key={p.tag}
              type="button"
              onClick={() => togglePreset(p.tag)}
              aria-pressed={active}
              title={`Classificar como ${p.label} (${meta.label})`}
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${active ? meta.cls : 'border-line bg-surface2 text-muted hover:text-text hover:border-line/80'}`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Etiquetas livres */}
      <div className="flex flex-wrap items-center gap-1.5 bg-surface2 border border-line rounded-lg px-2.5 py-2 focus-within:border-sonar focus-within:shadow-glow transition-all">
        {custom.map((t) => (
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
          placeholder={full ? `máx. ${TAG_MAX_COUNT}` : custom.length ? 'adicionar…' : 'ex.: negociando, judicial'}
          aria-label="Adicionar etiqueta"
          className="flex-1 min-w-24 bg-transparent text-text font-sans text-sm placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
