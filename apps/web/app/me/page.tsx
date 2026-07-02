'use client';

import Link from 'next/link';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';
import {
  C, round, sans, Screen, Header, Card, Avatar, CofreBar, GentleBadge, gentleStatus, formatBRLSoft,
  LocationGlyph, CofreGlyph,
} from '@/components/family';
import { useMyDebts, pickPrimary, cofreValues, type MyGoal } from '@/lib/sobrinho';

// INÍCIO — a casa do app: sua família e como vai sua meta de economia.
// Sem cara de cobrança: é sobre pessoas próximas e um objetivo em andamento.

function ConnectionCard() {
  // Conexão neutra (sem citar quem está do outro lado nem papel financeiro).
  return (
    <Card className="flex items-center gap-3.5">
      <Avatar name="Família" tone="coral" size={52} />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold" style={{ ...round, color: C.ink }}>Sua rede</p>
        <p className="text-[13.5px] leading-snug" style={{ color: C.soft }}>Pessoas de confiança que caminham junto com você.</p>
      </div>
      <span className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ background: C.mintSoft, color: C.mint, ...sans }}>conectado</span>
    </Card>
  );
}

function CofreSummary({ goal }: { goal: MyGoal }) {
  const { faltaGuardar, pct } = cofreValues(goal);
  const st = gentleStatus(goal.summary.status, goal.summary.settled, goal.summary.daysRemaining);
  return (
    <Link href="/viagem" className="block active:scale-[0.99] transition-transform">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ background: C.mintSoft, color: C.mint }}><CofreGlyph active /></span>
            <p className="text-[16px] font-semibold" style={{ ...round, color: C.ink }}>Meu cofre</p>
          </div>
          <GentleBadge tone={st.tone}>{st.label}</GentleBadge>
        </div>

        {goal.summary.settled ? (
          <p className="text-[15px]" style={{ color: C.soft }}>Você alcançou sua meta. 🎉</p>
        ) : (
          <>
            <CofreBar pct={pct} settled={false} />
            <div className="flex items-baseline justify-between mt-3.5">
              <span className="text-[13px]" style={{ color: C.soft }}>Falta guardar</span>
              <span className="text-[22px] font-bold" style={{ ...round, color: C.ink }}>{formatBRLSoft(faltaGuardar)}</span>
            </div>
          </>
        )}
        <p className="text-[13px] mt-3 font-semibold" style={{ color: C.sky }}>Ver meu cofre →</p>
      </Card>
    </Link>
  );
}

function LocationHint() {
  return (
    <Link href="/local" className="block active:scale-[0.99] transition-transform">
      <Card className="flex items-center gap-3.5">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full" style={{ background: C.coralSoft, color: C.coral }}><LocationGlyph active /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold" style={{ ...round, color: C.ink }}>Localização em família</p>
          <p className="text-[13px] leading-snug" style={{ color: C.soft }}>Só com quem você confia — você controla quando.</p>
        </div>
        <span style={{ color: C.faint }}>›</span>
      </Card>
    </Link>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      {[64, 150, 76].map((h, i) => (
        <div key={i} className="rounded-[22px] animate-pulse" style={{ height: h, background: '#EFE9E1' }} />
      ))}
    </div>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card pad="p-9" className="flex flex-col items-center text-center">
      <span className="text-[40px]" aria-hidden>🌤️</span>
      <h2 className="text-[19px] font-bold mt-3" style={{ ...round, color: C.ink }}>{title}</h2>
      <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>{subtitle}</p>
    </Card>
  );
}

export default function InicioPage() {
  const q = useMyDebts();
  const debts = q.data ?? [];
  const primary = pickPrimary(debts);

  return (
    <Screen>
      <Header eyebrow="Olá 👋" title="Início" />
      <ConnectionCard />

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Empty title="Vamos tentar de novo?" subtitle="Abra novamente o convite que você recebeu." />
      ) : !primary ? (
        <Empty title="Tudo tranquilo por aqui" subtitle="Nenhuma meta ativa no momento." />
      ) : (
        <CofreSummary goal={primary} />
      )}

      <LocationHint />

      <LocationSync />
      <DebtorTabBar />
    </Screen>
  );
}
