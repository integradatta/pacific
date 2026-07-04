'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';
import { debtorApiPost } from '@/lib/debtor';
import {
  C, round, sans, Screen, Header, Card, SectionTitle, CofreBar, GentleBadge,
  GentleCheck, gentleStatus, formatBRLSoft,
} from '@/components/family';
import { useMyDebts, pickPrimary, cofreValues, type MyGoal, type PaymentPoint } from '@/lib/sobrinho';

// MEU COFRE — a meta de economia apresentada como um cofrinho, nunca como extrato de dívida.
// Linguagem: "Meta", "Guardado", "Falta guardar", "depósito". Timeline gentil, sem tabela contábil.
// White-label: nenhuma menção a credor/padrinho, cobrança, juros ou pagamento.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function HeroCofre({ goal }: { goal: MyGoal }) {
  const { meta, guardado, faltaGuardar, pct } = cofreValues(goal);
  const s = goal.summary;
  const st = gentleStatus(s.status, s.settled, s.daysRemaining);
  return (
    <Card pad="p-6">
      <div className="flex items-center justify-between mb-4">
        <GentleBadge tone={st.tone}>{st.label}</GentleBadge>
        {!s.settled && <span className="text-[12.5px]" style={{ color: C.soft }}>{s.daysRemaining < 0 ? `meta era ${fmt(goal.dueDate)}` : `meta até ${fmt(goal.dueDate)}`}</span>}
      </div>

      <CofreBar pct={pct} settled={s.settled} />
      {!s.settled && <p className="text-center text-[13px] mt-2.5 font-semibold" style={{ ...round, color: C.mint }}>{pct}% guardado</p>}

      <div className="grid grid-cols-3 gap-2 mt-6 text-center">
        <div>
          <p className="text-[11.5px]" style={{ color: C.soft }}>Meta</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: C.ink }}>{formatBRLSoft(meta)}</p>
        </div>
        <div>
          <p className="text-[11.5px]" style={{ color: C.mint }}>Guardado</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: C.mint }}>{formatBRLSoft(guardado)}</p>
        </div>
        <div>
          <p className="text-[11.5px]" style={{ color: C.soft }}>Falta guardar</p>
          <p className="text-[15px] font-bold mt-0.5" style={{ ...round, color: s.settled ? C.mint : C.ink }}>{s.settled ? '—' : formatBRLSoft(faltaGuardar)}</p>
        </div>
      </div>
      {goal.rejectedClaim && !goal.pendingClaim && (
        <div className="mt-5 rounded-[14px] px-4 py-3" style={{ background: C.warmSoft }}>
          <p className="text-[13.5px] leading-relaxed" style={{ color: '#9A5B2E' }}>
            Seu depósito de {formatBRLSoft(goal.rejectedClaim.amount)} ainda não foi confirmado. Sem problema — vale conferir com sua rede e registrar de novo. 💛
          </p>
        </div>
      )}
    </Card>
  );
}

// "Registrar um depósito" — o sobrinho avisa que guardou uma parte; a rede confirma depois.
function DepositBox({ goal }: { goal: MyGoal }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(goal.summary.amountDue);
  const [note, setNote] = useState('');
  const claim = useMutation({
    mutationFn: () => debtorApiPost(`/debtor/me/debts/${goal.id}/claim`, { amount, note: note.trim() || undefined }),
    onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ['me-debts'] }); },
  });

  if (goal.pendingClaim) {
    return (
      <Card className="flex items-start gap-3">
        <GentleCheck size={40} />
        <div className="min-w-0">
          <p className="text-[15px]" style={{ color: C.ink }}>Você registrou <b>{formatBRLSoft(goal.pendingClaim.amount)}</b> em {fmtShort(goal.pendingClaim.claimedAt)}.</p>
          <p className="text-[13px] mt-0.5" style={{ color: C.soft }}>Sua rede confirma quando puder. Sem pressa. 💛</p>
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
          Adicionei ao cofre
        </button>
      ) : (
        <div className="space-y-3">
          <SectionTitle>Registrar um depósito</SectionTitle>
          <div>
            <label htmlFor="amt" className="block text-[13px] mb-1" style={{ color: C.soft }}>Quanto você guardou?</label>
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
              id="nt" type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: guardei um pouco hoje 💚"
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
              {claim.isPending ? 'Registrando…' : 'Registrar depósito'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[14px] px-3 py-3" style={{ color: C.soft }}>Agora não</button>
          </div>
          <p className="text-[12px]" style={{ color: C.faint }}>É só um registro. Vale quando sua rede confirmar.</p>
        </div>
      )}
    </Card>
  );
}

// Seus depósitos — timeline amigável do quanto você foi guardando (nunca tabela contábil).
function Timeline({ payments }: { payments: PaymentPoint[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <SectionTitle>Seus depósitos</SectionTitle>
        <p className="text-[14.5px]" style={{ color: C.soft }}>Sua meta está só começando. Cada depósito aparece aqui. ✨</p>
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
      <SectionTitle>Seus depósitos</SectionTitle>
      <ol className="relative pl-6">
        <span className="absolute left-[9px] top-1.5 bottom-2 w-[2px] rounded-full" style={{ background: C.line }} aria-hidden />
        {rows.map((r, i) => (
          <li key={i} className="relative pb-4 last:pb-0">
            <span className="absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ background: C.mintSoft, border: `2px solid ${C.card}` }} aria-hidden>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.mint }} />
            </span>
            <p className="text-[15px]" style={{ color: C.ink }}>Você guardou <b>{formatBRLSoft(r.inc)}</b></p>
            <p className="text-[12.5px]" style={{ color: C.faint }}>{fmt(r.at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// Sinais leves à rede: "vou guardar até…" / "preciso de ajuda". Compacto, gentil, sem cobrança.
function SignalsBox({ goal }: { goal: MyGoal }) {
  void goal;
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
        <p className="text-[15px]" style={{ color: C.ink }}>{done === 'intent' ? 'Combinado! Avisamos sua rede da sua meta. 💛' : 'Pronto — sua rede foi avisada de que você quer conversar. 💛'}</p>
      </Card>
    );
  }

  const softBtn = 'rounded-[14px] py-3 text-[14px] font-semibold transition-all active:translate-y-px';
  return (
    <Card>
      <SectionTitle>Precisa de ajuda?</SectionTitle>
      {mode === null ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setMode('intent')} className={softBtn} style={{ ...sans, background: C.skySoft, color: C.sky }}>📅 Vou guardar até…</button>
          <button type="button" onClick={() => setMode('support')} className={softBtn} style={{ ...sans, background: C.coralSoft, color: C.coral }}>💬 Preciso de ajuda</button>
        </div>
      ) : mode === 'intent' ? (
        <div className="space-y-3">
          <label htmlFor="sig-date" className="block text-[13px]" style={{ color: C.soft }}>Até quando você pretende alcançar a meta?</label>
          <input id="sig-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-[14px] bg-white px-3.5 py-3 text-[15px] focus:outline-none" style={{ ...sans, color: C.ink, border: `1.5px solid ${C.line}` }} />
          <div className="flex items-center gap-2">
            <button type="button" disabled={!dueDate || send.isPending} onClick={() => send.mutate({ kind: 'INTENT_TO_PAY', dueDate: new Date(dueDate).toISOString() })}
              className="flex-1 text-white text-[14px] font-semibold rounded-[14px] py-3 disabled:opacity-50" style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})` }}>
              {send.isPending ? 'Enviando…' : 'Avisar minha rede'}
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
              {send.isPending ? 'Enviando…' : 'Pedir ajuda'}
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

export default function CofrePage() {
  const q = useMyDebts();
  const goals = q.data ?? [];
  const primary = pickPrimary(goals);

  return (
    <Screen>
      <Header eyebrow="Sua meta de economia" title="Meu cofre" />

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Card pad="p-9" className="flex flex-col items-center text-center">
          <span className="text-[40px]" aria-hidden>🐷</span>
          <h2 className="text-[19px] font-bold mt-3" style={{ ...round, color: C.ink }}>Vamos tentar de novo?</h2>
          <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>Abra novamente o convite que você recebeu.</p>
        </Card>
      ) : !primary ? (
        <Card pad="p-9" className="flex flex-col items-center text-center">
          <span className="text-[40px]" aria-hidden>🌤️</span>
          <h2 className="text-[19px] font-bold mt-3" style={{ ...round, color: C.ink }}>Nenhuma meta por enquanto</h2>
          <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>Quando houver uma meta, ela aparece aqui.</p>
        </Card>
      ) : (
        <>
          <HeroCofre goal={primary} />
          {!primary.summary.settled && <DepositBox goal={primary} />}
          {!primary.summary.settled && <SignalsBox goal={primary} />}
          <Timeline payments={primary.payments} />
        </>
      )}

      <LocationSync />
      <DebtorTabBar />
    </Screen>
  );
}
