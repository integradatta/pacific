'use client';

import type { ReactNode } from 'react';
import type { DebtStatus } from '@pacific/shared';

/*
 * Identidade do app do SOBRINHO — rede de confiança entre pessoas próximas (tom Life360 /
 * Find My / Family Link). NADA de cara de cobrança/vigilância: paleta quente, formas
 * arredondadas, avatares de pessoas (sem cadeado/alvo/radar/lupa), copy gentil.
 * Autocontido (cores/fontes explícitas) para não afetar o tema escuro do padrinho/admin.
 */

// ── Paleta quente ────────────────────────────────────────────────────────────
export const C = {
  bg: '#FAF7F3', // marfim quente (nunca cinza corporativo)
  card: '#FFFFFF',
  ink: '#2B2A28', // quase-preto quente
  soft: '#8B8578', // texto secundário quente
  faint: '#B7B0A6',
  line: '#EFE9E1',
  sky: '#5B9CF6', // azul suave — conexão/confiança
  skySoft: '#E9F2FF',
  mint: '#2FB98A', // verde caloroso — já resolvido / progresso
  mintSoft: '#E4F6EE',
  coral: '#FF8B6B', // coral — pessoas / calor
  coralSoft: '#FFECE5',
  sun: '#F3B24C', // âmbar — destino / meta
  sunSoft: '#FDF1DC',
  warm: '#EC9A57', // âmbar-suave p/ "ainda falta" (NUNCA vermelho de alerta)
  warmSoft: '#FBEBDA',
} as const;

export const round = { fontFamily: 'var(--font-round)' } as const; // Baloo 2 — títulos calorosos
export const sans = { fontFamily: 'var(--font-dmsans)' } as const; // DM Sans — corpo/UI

export const formatBRLSoft = (v: string | number): string =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Wrappers ─────────────────────────────────────────────────────────────────
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen"
      style={{ background: C.bg, color: C.ink, ...sans, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
    >
      <div className="max-w-[480px] mx-auto px-4 pt-7 space-y-4 animate-rise">{children}</div>
    </main>
  );
}

export function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="px-1 pb-1">
      <p className="text-[14px]" style={{ color: C.soft }}>{eyebrow}</p>
      <h1 className="text-[28px] leading-tight" style={{ ...round, fontWeight: 700, color: C.ink }}>{title}</h1>
    </header>
  );
}

export function Card({ children, className = '', pad = 'p-5' }: { children: ReactNode; className?: string; pad?: string }) {
  return (
    <section className={`rounded-[22px] ${pad} ${className}`} style={{ background: C.card, boxShadow: '0 6px 20px -12px rgba(120,90,60,0.28)', border: `1px solid ${C.line}` }}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold mb-3" style={{ color: C.soft, ...sans }}>{children}</p>;
}

// ── Avatar (pessoa, nunca ícone de vigilância) ───────────────────────────────
export function Avatar({ name, tone = 'coral', size = 44 }: { name: string; tone?: keyof typeof AVATAR; size?: number }) {
  const t = AVATAR[tone];
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '♥';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 font-semibold"
      style={{ width: size, height: size, background: t.bg, color: t.fg, ...round, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
const AVATAR = {
  coral: { bg: C.coralSoft, fg: C.coral },
  sky: { bg: C.skySoft, fg: C.sky },
  mint: { bg: C.mintSoft, fg: C.mint },
  sun: { bg: C.sunSoft, fg: C.sun },
} as const;

// ── Trilha da viagem (elemento-assinatura) ───────────────────────────────────
// Começo (você) → marcador no progresso → destino (bandeira). Gradiente sky→mint.
export function TripTrail({ pct, settled }: { pct: number; settled: boolean }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-[12px]" style={{ color: C.soft }}>
        <span className="inline-flex items-center gap-1"><Dot color={C.sky} /> Início</span>
        <span className="inline-flex items-center gap-1">Destino <Flag /></span>
      </div>
      <div className="relative h-3 rounded-full" style={{ background: C.line }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${C.sky}, ${C.mint})`, transition: 'width 700ms ease' }} />
        {/* marcador (você) andando na trilha */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ left: `${p}%`, background: C.card, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: `2px solid ${settled ? C.mint : C.sky}`, transition: 'left 700ms ease' }}
          aria-hidden
        >
          <span className="text-[12px]">{settled ? '🎉' : '🧭'}</span>
        </div>
      </div>
    </div>
  );
}
function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />;
}
function Flag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sun} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V4c4-2 8 2 12 0v9c-4 2-8-2-12 0" fill={C.sunSoft} />
      <line x1="5" y1="21" x2="5" y2="3" />
    </svg>
  );
}

// ── Barra simples e helpers ──────────────────────────────────────────────────
export function SoftBar({ pct, from, to }: { pct: number; from: string; to: string }) {
  return (
    <span className="block h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${from}, ${to})`, transition: 'width 600ms ease' }} />
    </span>
  );
}

export function GentleBadge({ tone, children }: { tone: keyof typeof BADGE; children: ReactNode }) {
  const t = BADGE[tone];
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: t.bg, color: t.fg, ...sans }}>
      {children}
    </span>
  );
}
const BADGE = {
  mint: { bg: C.mintSoft, fg: C.mint },
  sky: { bg: C.skySoft, fg: C.sky },
  sun: { bg: C.sunSoft, fg: '#C98A2E' },
  warm: { bg: C.warmSoft, fg: '#C47B3C' },
} as const;

// Status gentil — sem "vencido/atenção/risco". Tom de convívio, nunca punitivo.
export function gentleStatus(status: DebtStatus, settled: boolean, daysRemaining: number): { label: string; tone: keyof typeof BADGE } {
  if (settled) return { label: 'Tudo certo ✨', tone: 'mint' };
  if (daysRemaining < 0) return { label: 'Passou da data combinada', tone: 'warm' };
  if (daysRemaining === 0) return { label: 'É hoje o combinado', tone: 'sun' };
  if (daysRemaining <= 7) return { label: 'Chegando perto', tone: 'sun' };
  return { label: 'No caminho', tone: 'sky' };
}

// ── Ícones amigáveis da navegação (arredondados, sem vigilância) ─────────────
export function HomeGlyph({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? C.coralSoft : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10.5 20v-4a1.5 1.5 0 0 1 3 0v4" />
    </svg>
  );
}
export function PeopleGlyph({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? C.coralSoft : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="8" r="2.2" />
      <path d="M15.5 13.6A4.5 4.5 0 0 1 20.5 18" />
    </svg>
  );
}
export function LocationGlyph({ active }: { active: boolean }) {
  // Pino com coração (pertencimento), não alvo/radar.
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? C.coralSoft : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5-6.5-10.5A6.5 6.5 0 0 1 18.5 10.5C18.5 16 12 21 12 21Z" />
      <path d="M12 12.5c-1-.8-2-1.5-2-2.6a1.3 1.3 0 0 1 2-1 1.3 1.3 0 0 1 2 1c0 1.1-1 1.8-2 2.6Z" />
    </svg>
  );
}
export function TripGlyph({ active }: { active: boolean }) {
  // Trilha sinuosa com bandeira — a "viagem".
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 20c0-3 3-3 3-6s-3-3-3-6 4-3 6-3" strokeDasharray="0.1 3.4" />
      <circle cx="6" cy="20" r="1.4" fill={active ? 'currentColor' : 'none'} />
      <path d="M16 4v7c1.6.8 3.2-.8 4.5 0V4c-1.3-.8-2.9.8-4.5 0Z" fill={active ? C.sunSoft : 'none'} />
    </svg>
  );
}
export function ProfileGlyph({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? C.coralSoft : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

// Check gentil de sucesso (pop suave, verde — nunca alerta vermelho).
export function GentleCheck({ size = 56 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full animate-pop" style={{ width: size, height: size, background: C.mintSoft }} aria-hidden>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 12.5 10 18 20 6" />
      </svg>
    </span>
  );
}
