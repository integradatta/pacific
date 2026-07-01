'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import type { DebtStatus } from '@pacific/shared';
import { debtorApiGet, debtorApiPost } from '@/lib/debtor';
import { formatBRL } from '@/lib/format';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';

/*
 * App do SOBRINHO — tema claro / family-friendly (design system azul do brief + alma "Cofrinho":
 * anel de progresso "quanto já foi pago" e tom de conquista). Estilo autocontido (cores/fontes
 * explícitas) para NÃO afetar o tema escuro do padrinho/admin. Mesma estrutura, dados e ações.
 */

interface PaymentPoint { at: string; total: string }
interface PendingClaim { amount: string; claimedAt: string }
interface MyDebt {
  id: string;
  principal: string;
  dueDate: string;
  payments: PaymentPoint[];
  pendingClaim: PendingClaim | null;
  summary: {
    balance: string;
    accruedInterest: string;
    paidAmount: string;
    amountDue: string;
    settled: boolean;
    daysRemaining: number;
    status: DebtStatus;
  };
}

// ── Tokens (do brief) ────────────────────────────────────────────────────────
const mono = { fontFamily: 'var(--font-dmmono)' } as const;
const sans = { fontFamily: 'var(--font-dmsans)' } as const;
const CARD = 'bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]';
const SECTION_TITLE = 'text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: '#E6F9F0', fg: '#34C97B' },
  warning: { bg: '#FEF4E0', fg: '#F5A623' },
  danger: { bg: '#FEECEB', fg: '#F25C54' },
  neutral: { bg: '#EEF1F5', fg: '#6B7280' },
};

function statusInfo(status: DebtStatus, settled: boolean): { tone: Tone; label: string } {
  if (settled) return { tone: 'success', label: 'Quitada' };
  if (status === 'RED') return { tone: 'danger', label: 'Vencido' };
  if (status === 'YELLOW' || status === 'ORANGE') return { tone: 'warning', label: 'Atenção' };
  return { tone: 'neutral', label: 'Em dia' };
}

const fmtLong = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function vencimentoTexto(daysRemaining: number, dueIso: string): string {
  if (daysRemaining < 0) return `Venceu em ${fmtLong(dueIso)}`;
  if (daysRemaining === 0) return `Vence hoje, ${fmtLong(dueIso)}`;
  return `Vence em ${fmtLong(dueIso)}`;
}
function diasTexto(daysRemaining: number): { txt: string; danger: boolean; warn: boolean } {
  if (daysRemaining < 0) return { txt: `Há ${Math.abs(daysRemaining)} dia${Math.abs(daysRemaining) === 1 ? '' : 's'}`, danger: true, warn: false };
  if (daysRemaining === 0) return { txt: 'Vence hoje', danger: false, warn: true };
  return { txt: `Faltam ${daysRemaining} dias`, danger: false, warn: daysRemaining <= 7 };
}

function smartSummary(d: MyDebt): string {
  const s = d.summary;
  if (s.settled) return 'Tudo certo por aqui — sua ajuda está quitada. 🎉';
  const venc = s.daysRemaining < 0 ? `venceu há ${Math.abs(s.daysRemaining)} dias` : s.daysRemaining === 0 ? 'vence hoje' : `vence em ${s.daysRemaining} dias`;
  const sit = s.status === 'RED' ? 'precisa de atenção' : s.status === 'YELLOW' || s.status === 'ORANGE' ? 'está chegando perto' : 'está em dia';
  return `Sua ajuda ${sit} e ${venc}. O valor atual é de ${formatBRL(s.amountDue)}.`;
}

// ── Componentes base ─────────────────────────────────────────────────────────
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

// Anel "Cofrinho": fração já paga do valor bruto. Azul; verde + 🎉 quando quitada.
function Ring({ pct, settled }: { pct: number; settled: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const color = settled ? '#34C97B' : '#4A7DFF';
  return (
    <div className="relative w-[136px] h-[136px]">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF1F5" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 700ms ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {settled ? (
          <span className="text-[30px]" aria-hidden>🎉</span>
        ) : (
          <>
            <span className="text-[30px] font-bold text-[#111827] leading-none" style={sans}>{pct}%</span>
            <span className="text-[11px] uppercase tracking-wide text-[#9CA3AF] mt-1">pago</span>
          </>
        )}
      </div>
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="block h-1.5 rounded-full bg-[#EEF1F5] overflow-hidden">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: 'width 600ms ease' }} />
    </span>
  );
}

// ── "Já paguei" (informar pagamento → o padrinho confirma) ───────────────────
function ClaimBox({ debt }: { debt: MyDebt }) {
  const qc = useQueryClient();
  const s = debt.summary;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(s.amountDue);
  const [note, setNote] = useState('');
  const claim = useMutation({
    mutationFn: () => debtorApiPost(`/debtor/me/debts/${debt.id}/claim`, { amount, note: note.trim() || undefined }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['me-debts'] });
    },
  });

  if (debt.pendingClaim) {
    return (
      <section className={`${CARD} p-5`}>
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#EBF0FF' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#4A7DFF' }} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] text-[#111827]">Você avisou <span style={mono} className="font-medium">{formatBRL(debt.pendingClaim.amount)}</span> em {fmtShort(debt.pendingClaim.claimedAt)}.</p>
            <p className="text-[13px] text-[#6B7280] mt-0.5">Aguardando a confirmação do seu padrinho.</p>
          </div>
        </div>
      </section>
    );
  }

  const valid = Number(amount) > 0;
  return (
    <section className={`${CARD} p-5`}>
      {!open ? (
        <button
          type="button" onClick={() => setOpen(true)}
          className="w-full text-white text-[15px] font-semibold rounded-[12px] py-3.5 active:translate-y-px transition-all"
          style={{ background: '#4A7DFF', boxShadow: '0 2px 8px rgba(74,125,255,0.3)' }}
        >
          Já paguei
        </button>
      ) : (
        <div className="space-y-3">
          <p className={SECTION_TITLE}>Avisar pagamento</p>
          <div>
            <label htmlFor="claim-amount" className="block text-[13px] text-[#6B7280] mb-1">Quanto você pagou?</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9CA3AF]" style={mono}>R$</span>
              <input
                id="claim-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-[12px] border border-[#E5E7EB] bg-white pl-10 pr-3 py-3 text-[15px] text-[#111827] focus:outline-none focus:border-[#4A7DFF] focus:ring-2 focus:ring-[#EBF0FF] transition-all"
                style={mono}
              />
            </div>
          </div>
          <div>
            <label htmlFor="claim-note" className="block text-[13px] text-[#6B7280] mb-1">Observação (opcional)</label>
            <input
              id="claim-note" type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: enviei por PIX hoje"
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#4A7DFF] focus:ring-2 focus:ring-[#EBF0FF] transition-all"
            />
          </div>
          {claim.isError && <p role="alert" className="text-[13px]" style={{ color: '#F25C54' }}>Não foi possível enviar. Tente novamente.</p>}
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => claim.mutate()} disabled={!valid || claim.isPending}
              className="flex-1 text-white text-[15px] font-semibold rounded-[12px] py-3.5 disabled:opacity-50 active:translate-y-px transition-all"
              style={{ background: '#4A7DFF', boxShadow: '0 2px 8px rgba(74,125,255,0.3)' }}
            >
              {claim.isPending ? 'Enviando…' : 'Enviar aviso'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-[#6B7280] px-3 py-3">Cancelar</button>
          </div>
          <p className="text-[12px] text-[#9CA3AF]">Isso avisa seu padrinho. O pagamento vale após ele confirmar.</p>
        </div>
      )}
    </section>
  );
}

// Evolução: valor original (+) gratidão (−) pagamentos (=) valor atual.
function Evolution({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  const base = Math.max(Number(s.balance), 1);
  const rows = [
    { label: 'Valor original', value: debt.principal, color: '#4A7DFF', op: '' },
    { label: 'Gratidão acumulada', value: s.accruedInterest, color: '#F5A623', op: '+' },
    { label: 'Pagamentos', value: s.paidAmount, color: '#34C97B', op: '−' },
  ];
  return (
    <section className={`${CARD} p-5`}>
      <p className={`${SECTION_TITLE} mb-4`}>Evolução da ajuda</p>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-[#6B7280]">{r.op && <span className="text-[#9CA3AF] mr-1">{r.op}</span>}{r.label}</span>
              <span className="text-[15px] text-[#111827] font-medium" style={mono}>{formatBRL(r.value)}</span>
            </div>
            <Bar pct={(Number(r.value) / base) * 100} color={r.color} />
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-[#F3F4F6] pt-3.5">
          <span className="text-[15px] text-[#111827] font-medium">= Valor atual</span>
          <span className="text-[20px] text-[#111827] font-semibold" style={mono}>{formatBRL(s.amountDue)}</span>
        </div>
      </div>
    </section>
  );
}

// Próximos eventos: lembretes derivados do vencimento (sem urgência/vermelho).
function UpcomingEvents({ debt }: { debt: MyDebt }) {
  if (debt.summary.settled) return null;
  const due = new Date(debt.dueDate);
  const now = new Date();
  const day = 86_400_000;
  const marks = [
    { at: new Date(due.getTime() - 7 * day), label: 'Lembrete automático' },
    { at: new Date(due.getTime() - 3 * day), label: 'Lembrete automático' },
    { at: new Date(due.getTime() - day), label: 'Lembrete: vence amanhã' },
    { at: due, label: 'Vencimento' },
  ].filter((m) => m.at.getTime() >= now.getTime() - day);
  if (marks.length === 0) return null;
  return (
    <section className={`${CARD} p-5`}>
      <p className={`${SECTION_TITLE} mb-3`}>Próximos eventos</p>
      <ol className="space-y-3">
        {marks.map((m, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.label === 'Vencimento' ? '#F5A623' : '#4A7DFF' }} />
            <span className="text-[13px] text-[#111827] tabular-nums w-16" style={mono}>{fmtShort(m.at.toISOString())}</span>
            <span className="text-[15px] text-[#6B7280]">{m.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Histórico financeiro: cada pagamento (data, valor pago no momento, total acumulado).
function History({ payments }: { payments: PaymentPoint[] }) {
  if (payments.length === 0) {
    return (
      <section className={`${CARD} p-5`}>
        <p className={`${SECTION_TITLE} mb-2`}>Histórico</p>
        <p className="text-[15px] text-[#6B7280]">Nenhum pagamento registrado ainda.</p>
      </section>
    );
  }
  let prev = new Decimal(0);
  const rows = payments.map((p) => {
    const total = new Decimal(p.total);
    const inc = Decimal.max(0, total.minus(prev));
    prev = total;
    return { at: p.at, inc: inc.toFixed(2), total: total.toFixed(2) };
  }).reverse();
  return (
    <section className={`${CARD} overflow-hidden`}>
      <p className={`${SECTION_TITLE} px-5 pt-5 pb-2`}>Histórico</p>
      <ul className="divide-y divide-[#F3F4F6]">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="text-[15px] text-[#111827]">Pagamento</p>
              <p className="text-[12px] text-[#9CA3AF] tabular-nums" style={mono}>{fmtShort(r.at)}</p>
            </div>
            <div className="text-right">
              <p className="text-[15px] tabular-nums" style={{ ...mono, color: '#34C97B' }}>+ {formatBRL(r.inc)}</p>
              <p className="text-[11px] text-[#9CA3AF] tabular-nums" style={mono}>total pago {formatBRL(r.total)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DebtView({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  const st = statusInfo(s.status, s.settled);
  const dias = diasTexto(s.daysRemaining);
  const pct = s.settled ? 100 : Math.round((Number(s.paidAmount) / Math.max(Number(s.balance), 1)) * 100);

  return (
    <div className="space-y-3.5">
      {/* Hero — anel de progresso + valor + situação */}
      <section className={`${CARD} p-6 flex flex-col items-center text-center`}>
        <Ring pct={pct} settled={s.settled} />
        <p className="text-[13px] text-[#6B7280] mt-4 mb-1">{s.settled ? 'Sua ajuda está' : 'Ainda falta'}</p>
        <p className="text-[30px] font-bold text-[#111827] leading-tight" style={mono}>
          {s.settled ? 'Quitada' : formatBRL(s.amountDue)}
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
          <Pill tone={st.tone}>{st.label}</Pill>
          {!s.settled && <span className="text-[13px] text-[#6B7280]">{vencimentoTexto(s.daysRemaining, debt.dueDate)}</span>}
        </div>
        {!s.settled && (
          <p className="text-[12px] mt-1.5" style={{ color: dias.danger ? '#F25C54' : dias.warn ? '#F5A623' : '#9CA3AF' }}>{dias.txt}</p>
        )}
      </section>

      {/* Resumo amigável */}
      <section className={`${CARD} p-5`}>
        <p className="text-[15px] text-[#374151] leading-relaxed">{smartSummary(debt)}</p>
      </section>

      {/* Já paguei (loop de mão dupla) */}
      {!s.settled && <ClaimBox debt={debt} />}

      <Evolution debt={debt} />
      <UpcomingEvents debt={debt} />
      <History payments={debt.payments} />
    </div>
  );
}

function OthersList({ debts }: { debts: MyDebt[] }) {
  if (debts.length === 0) return null;
  return (
    <section className={`${CARD} p-5`}>
      <p className={`${SECTION_TITLE} mb-3`}>Outras ajudas</p>
      <ul className="divide-y divide-[#F3F4F6] -my-1.5">
        {debts.map((d) => {
          const st = statusInfo(d.summary.status, d.summary.settled);
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TONE[st.tone].fg }} />
                <span className="text-[13px] text-[#6B7280] tabular-nums" style={mono}>vence {fmtShort(d.dueDate)}</span>
              </div>
              <span className="text-[15px] text-[#111827] font-medium tabular-nums" style={mono}>{formatBRL(d.summary.settled ? '0.00' : d.summary.amountDue)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Estados (skeleton / vazio) ───────────────────────────────────────────────
function Skeleton({ className }: { className: string }) {
  return <div className={`bg-[#EEF1F5] animate-pulse rounded-[10px] ${className}`} />;
}
function LoadingState() {
  return (
    <div className="space-y-3.5">
      <section className={`${CARD} p-6 flex flex-col items-center gap-4`}>
        <Skeleton className="w-[136px] h-[136px] !rounded-full" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-5 w-28" />
      </section>
      <Skeleton className="h-20 w-full !rounded-[16px]" />
      <Skeleton className="h-32 w-full !rounded-[16px]" />
    </div>
  );
}
function CheckCircle() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34C97B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={`${CARD} p-10 flex flex-col items-center text-center`}>
      <CheckCircle />
      <h2 className="text-[20px] font-bold text-[#111827] mt-4" style={sans}>{title}</h2>
      <p className="text-[15px] text-[#6B7280] mt-1.5">{subtitle}</p>
    </div>
  );
}

export default function MePage() {
  const q = useQuery({ queryKey: ['me-debts'], queryFn: () => debtorApiGet<MyDebt[]>('/debtor/me/debts') });
  const debts = q.data ?? [];
  const primary = debts.find((d) => !d.summary.settled) ?? debts[0];
  const others = debts.filter((d) => d !== primary);

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#111827]" style={{ ...sans, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}>
      <div className="max-w-[480px] mx-auto px-4 pt-8 space-y-5 animate-rise">
        {/* Header */}
        <header className="px-1">
          <p className="text-[15px] text-[#6B7280]">Olá 👋</p>
          <h1 className="text-[30px] font-bold text-[#111827] tracking-tight" style={sans}>Sua ajuda</h1>
        </header>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <EmptyState title="Não foi possível carregar" subtitle="Abra novamente o link que seu padrinho enviou." />
        ) : !primary ? (
          <EmptyState title="Tudo em ordem" subtitle="Nenhuma ajuda registrada no momento." />
        ) : (
          <>
            <DebtView debt={primary} />
            <OthersList debts={others} />
          </>
        )}
      </div>
      <LocationSync />
      <DebtorTabBar />
    </main>
  );
}
