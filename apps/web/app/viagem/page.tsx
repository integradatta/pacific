'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';
import { debtorApiPost } from '@/lib/debtor';
import {
  C, round, sans, Screen, Header, Card, SectionTitle, Avatar, TripTrail, SoftBar, GentleBadge,
  GentleCheck, gentleStatus, formatBRLSoft,
} from '@/components/family';
import { useMyDebts, pickPrimary, tripValues, type MyDebt, type PaymentPoint } from '@/lib/sobrinho';

// PENDÊNCIAS VIAGEM — o combinado com o padrinho como uma "viagem", nunca como extrato de dívida.
// Linguagem: "Valor combinado", "Já resolvido", "Ainda falta". Timeline gentil, sem tabela contábil.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function HeroTrip({ debt }: { debt: MyDebt }) {
  const { combinado, resolvido, falta, pct } = tripValues(debt);
  const s = debt.summary;
  const st = gentleStatus(s.status, s.settled, s.daysRemaining);
  return (
    <Card pad="p-6">
      <div className="flex items-center justify-between mb-4">
        <GentleBadge tone={st.tone}>{st.label}</GentleBadge>
        {!s.settled && <span className="text-[12.5px]" style={{ color: C.soft }}>{s.daysRemaining < 0 ? `data combinada: ${fmt(debt.dueDate)}` : `combinado até ${fmt(debt.dueDate)}`}</span>}
      </div>

      <TripTrail pct={pct} settled={s.settled} />

      <div className="grid grid-cols-3 gap-2 mt-6 text-center">
        <div>
          <p className="text-[11.5px]" style={{ color: C.soft }}>Combinado</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: C.ink }}>{formatBRLSoft(combinado)}</p>
        </div>
        <div>
          <p className="text-[11.5px]" style={{ color: C.mint }}>Já resolvido</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: C.mint }}>{formatBRLSoft(resolvido)}</p>
        </div>
        <div>
          <p className="text-[11.5px]" style={{ color: C.soft }}>Ainda falta</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: s.settled ? C.mint : C.ink }}>{s.settled ? '—' : formatBRLSoft(falta)}</p>
        </div>
      </div>
    </Card>
  );
}

function WithWhom() {
  return (
    <Card className="flex items-center gap-3.5">
      <Avatar name="Seu padrinho" tone="coral" size={46} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px]" style={{ color: C.soft }}>Este combinado é com</p>
        <p className="text-[15.5px] font-semibold" style={{ ...round, color: C.ink }}>Seu padrinho</p>
      </div>
      <span className="text-[20px]" aria-hidden>🤝</span>
    </Card>
  );
}

// "Já resolvi" — o sobrinho avisa que resolveu uma parte; o padrinho confirma depois.
function ResolveBox({ debt }: { debt: MyDebt }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(debt.summary.amountDue);
  const [note, setNote] = useState('');
  const claim = useMutation({
    mutationFn: () => debtorApiPost(`/debtor/me/debts/${debt.id}/claim`, { amount, note: note.trim() || undefined }),
    onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ['me-debts'] }); },
  });

  if (debt.pendingClaim) {
    return (
      <Card className="flex items-start gap-3">
        <GentleCheck size={40} />
        <div className="min-w-0">
          <p className="text-[15px]" style={{ color: C.ink }}>Você avisou <b>{formatBRLSoft(debt.pendingClaim.amount)}</b> em {fmtShort(debt.pendingClaim.claimedAt)}.</p>
          <p className="text-[13px] mt-0.5" style={{ color: C.soft }}>Seu padrinho vai confirmar quando puder. Sem pressa. 💛</p>
        </div>
      </Card>
    );
  }

  const valid = Number(amount) > 0;
  return (
    <Card>
      {!open ? (
        <button
          type="button" onClick={() => setOpen(true)}
          className="w-full text-white text-[16px] font-semibold rounded-[16px] py-3.5 active:translate-y-px transition-all"
          style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})`, boxShadow: '0 6px 16px -6px rgba(47,185,138,0.5)' }}
        >
          Já resolvi uma parte
        </button>
      ) : (
        <div className="space-y-3">
          <SectionTitle>Avisar que resolveu</SectionTitle>
          <div>
            <label htmlFor="amt" className="block text-[13px] mb-1" style={{ color: C.soft }}>Quanto você resolveu?</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: C.faint }}>R$</span>
              <input
                id="amt" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-[14px] bg-white pl-10 pr-3 py-3 text-[16px] focus:outline-none transition-all"
                style={{ ...sans, color: C.ink, border: `1.5px solid ${C.line}` }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.sky)}
                onBlur={(e) => (e.currentTarget.style.borderColor = C.line)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="nt" className="block text-[13px] mb-1" style={{ color: C.soft }}>Quer deixar um recado? (opcional)</label>
            <input
              id="nt" type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: enviei por Pix hoje 💚"
              className="w-full rounded-[14px] bg-white px-3.5 py-3 text-[15px] focus:outline-none transition-all"
              style={{ ...sans, color: C.ink, border: `1.5px solid ${C.line}` }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.sky)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.line)}
            />
          </div>
          {claim.isError && <p role="alert" className="text-[13px]" style={{ color: C.warm }}>Não deu certo agora. Tente de novo em um instante.</p>}
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => claim.mutate()} disabled={!valid || claim.isPending}
              className="flex-1 text-white text-[15px] font-semibold rounded-[14px] py-3.5 disabled:opacity-50 active:translate-y-px transition-all"
              style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})` }}
            >
              {claim.isPending ? 'Enviando…' : 'Avisar meu padrinho'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[14px] px-3 py-3" style={{ color: C.soft }}>Agora não</button>
          </div>
          <p className="text-[12px]" style={{ color: C.faint }}>Isso é só um aviso carinhoso. Vale quando seu padrinho confirmar.</p>
        </div>
      )}
    </Card>
  );
}

// Como o combinado se formou — valor + gratidão − já resolvido = ainda falta (barras suaves).
function HowItFormed({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  const base = Math.max(Number(s.balance), 1);
  const rows = [
    { label: 'Valor combinado', value: debt.principal, from: C.sky, to: '#8FC0FF' },
    { label: 'Gratidão', value: s.accruedInterest, from: C.sun, to: '#F8CD82' },
    { label: 'Já resolvido', value: s.paidAmount, from: C.mint, to: '#77D8B4' },
  ];
  return (
    <Card>
      <SectionTitle>Como o combinado se formou</SectionTitle>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[14.5px]" style={{ color: C.soft }}>{r.label}</span>
              <span className="text-[14.5px] font-semibold" style={{ ...sans, color: C.ink }}>{formatBRLSoft(r.value)}</span>
            </div>
            <SoftBar pct={(Number(r.value) / base) * 100} from={r.from} to={r.to} />
          </div>
        ))}
        <div className="flex items-baseline justify-between pt-3.5" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-[15px] font-semibold" style={{ color: C.ink }}>Ainda falta</span>
          <span className="text-[20px] font-bold" style={{ ...round, color: C.ink }}>{formatBRLSoft(s.amountDue)}</span>
        </div>
      </div>
    </Card>
  );
}

// Momentos da viagem — timeline amigável dos pagamentos (nunca tabela contábil).
function Timeline({ payments }: { payments: PaymentPoint[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <SectionTitle>Momentos da viagem</SectionTitle>
        <p className="text-[14.5px]" style={{ color: C.soft }}>A jornada está só começando. Cada passo aparece aqui. ✨</p>
      </Card>
    );
  }
  let prev = new Decimal(0);
  const rows = payments.map((p) => {
    const total = new Decimal(p.total);
    const inc = Decimal.max(0, total.minus(prev));
    prev = total;
    return { at: p.at, inc: inc.toFixed(2) };
  }).reverse();
  return (
    <Card>
      <SectionTitle>Momentos da viagem</SectionTitle>
      <ol className="relative pl-6">
        <span className="absolute left-[9px] top-1.5 bottom-2 w-[2px] rounded-full" style={{ background: C.line }} aria-hidden />
        {rows.map((r, i) => (
          <li key={i} className="relative pb-4 last:pb-0">
            <span className="absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ background: C.mintSoft, border: `2px solid ${C.card}` }} aria-hidden>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.mint }} />
            </span>
            <p className="text-[15px]" style={{ color: C.ink }}>Você resolveu <b>{formatBRLSoft(r.inc)}</b></p>
            <p className="text-[12.5px]" style={{ color: C.faint }}>{fmt(r.at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// #3 — Sinais ao padrinho: "pretendo resolver até…" / "preciso de suporte". Compacto, gentil.
function SignalsBox({ debt }: { debt: MyDebt }) {
  const [mode, setMode] = useState<null | 'intent' | 'support'>(null);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<null | 'intent' | 'support'>(null);
  const send = useMutation({
    mutationFn: (body: { kind: 'INTENT_TO_PAY' | 'NEED_SUPPORT'; dueDate?: string; note?: string }) => debtorApiPost('/debtor/me/signals', body),
    onSuccess: (_r, body) => { setDone(body.kind === 'INTENT_TO_PAY' ? 'intent' : 'support'); setMode(null); setDueDate(''); setNote(''); },
  });

  if (done) {
    return (
      <Card className="flex items-start gap-3">
        <GentleCheck size={40} />
        <p className="text-[15px]" style={{ color: C.ink }}>{done === 'intent' ? 'Combinado! Avisamos seu padrinho da sua intenção. 💛' : 'Pronto — seu padrinho foi avisado de que você precisa conversar. 💛'}</p>
      </Card>
    );
  }

  const softBtn = 'rounded-[14px] py-3 text-[14px] font-semibold transition-all active:translate-y-px';
  return (
    <Card>
      <SectionTitle>Fale com seu padrinho</SectionTitle>
      {mode === null ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setMode('intent')} className={softBtn} style={{ ...sans, background: C.skySoft, color: C.sky }}>📅 Pretendo resolver até…</button>
          <button type="button" onClick={() => setMode('support')} className={softBtn} style={{ ...sans, background: C.coralSoft, color: C.coral }}>💬 Preciso de suporte</button>
        </div>
      ) : mode === 'intent' ? (
        <div className="space-y-3">
          <label htmlFor="sig-date" className="block text-[13px]" style={{ color: C.soft }}>Até quando você pretende resolver?</label>
          <input id="sig-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-[14px] bg-white px-3.5 py-3 text-[15px] focus:outline-none" style={{ ...sans, color: C.ink, border: `1.5px solid ${C.line}` }} />
          <div className="flex items-center gap-2">
            <button type="button" disabled={!dueDate || send.isPending} onClick={() => send.mutate({ kind: 'INTENT_TO_PAY', dueDate: new Date(dueDate).toISOString() })}
              className="flex-1 text-white text-[14px] font-semibold rounded-[14px] py-3 disabled:opacity-50" style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})` }}>
              {send.isPending ? 'Enviando…' : 'Avisar meu padrinho'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-[13px] px-3 py-3" style={{ color: C.soft }}>Voltar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="sig-note" className="block text-[13px]" style={{ color: C.soft }}>Quer contar rapidinho o que houve? (opcional)</label>
          <input id="sig-note" type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: tive um imprevisto este mês"
            className="w-full rounded-[14px] bg-white px-3.5 py-3 text-[15px] focus:outline-none" style={{ ...sans, color: C.ink, border: `1.5px solid ${C.line}` }} />
          <div className="flex items-center gap-2">
            <button type="button" disabled={send.isPending} onClick={() => send.mutate({ kind: 'NEED_SUPPORT', note: note.trim() || undefined })}
              className="flex-1 text-white text-[14px] font-semibold rounded-[14px] py-3 disabled:opacity-50" style={{ ...round, background: `linear-gradient(135deg, ${C.coral}, ${C.sun})` }}>
              {send.isPending ? 'Enviando…' : 'Pedir suporte'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-[13px] px-3 py-3" style={{ color: C.soft }}>Voltar</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      {[190, 72, 150].map((h, i) => (
        <div key={i} className="rounded-[22px] animate-pulse" style={{ height: h, background: '#EFE9E1' }} />
      ))}
    </div>
  );
}

export default function ViagemPage() {
  const q = useMyDebts();
  const debts = q.data ?? [];
  const primary = pickPrimary(debts);

  return (
    <Screen>
      <Header eyebrow="Combinado com seu padrinho" title="Sua viagem" />

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Card pad="p-9" className="flex flex-col items-center text-center">
          <span className="text-[40px]" aria-hidden>🧭</span>
          <h2 className="text-[19px] font-bold mt-3" style={{ ...round, color: C.ink }}>Vamos tentar de novo?</h2>
          <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>Abra novamente o convite do seu padrinho.</p>
        </Card>
      ) : !primary ? (
        <Card pad="p-9" className="flex flex-col items-center text-center">
          <span className="text-[40px]" aria-hidden>🌤️</span>
          <h2 className="text-[19px] font-bold mt-3" style={{ ...round, color: C.ink }}>Nenhuma viagem por enquanto</h2>
          <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>Quando houver um combinado, ele aparece aqui.</p>
        </Card>
      ) : (
        <>
          <HeroTrip debt={primary} />
          <WithWhom />
          {!primary.summary.settled && <ResolveBox debt={primary} />}
          {!primary.summary.settled && <SignalsBox debt={primary} />}
          <HowItFormed debt={primary} />
          <Timeline payments={primary.payments} />
        </>
      )}

      <LocationSync />
      <DebtorTabBar />
    </Screen>
  );
}
