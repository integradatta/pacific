'use client';

import Link from 'next/link';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';
import {
  C, round, sans, Screen, Header, Card, Avatar, TripTrail, GentleBadge, gentleStatus, formatBRLSoft,
  LocationGlyph, TripGlyph,
} from '@/components/family';
import { useMyDebts, pickPrimary, tripValues, type MyDebt } from '@/lib/sobrinho';

// INÍCIO / CONEXÕES — a casa do sobrinho: quem faz parte da sua rede e como vai a viagem.
// Sem cara de cobrança: é sobre pessoas próximas e um combinado em andamento.

function ConnectionCard() {
  // A API do sobrinho ainda não devolve o nome do padrinho → avatar amigável + rótulo gentil.
  return (
    <Card className="flex items-center gap-3.5">
      <Avatar name="Seu padrinho" tone="coral" size={52} />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold" style={{ ...round, color: C.ink }}>Seu padrinho</p>
        <p className="text-[13.5px] leading-snug" style={{ color: C.soft }}>Alguém de confiança que caminha junto com você.</p>
      </div>
      <span className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ background: C.mintSoft, color: C.mint, ...sans }}>conectado</span>
    </Card>
  );
}

function TripSummary({ debt }: { debt: MyDebt }) {
  const { falta, pct } = tripValues(debt);
  const st = gentleStatus(debt.summary.status, debt.summary.settled, debt.summary.daysRemaining);
  return (
    <Link href="/viagem" className="block active:scale-[0.99] transition-transform">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ background: C.skySoft, color: C.sky }}><TripGlyph active /></span>
            <p className="text-[16px] font-semibold" style={{ ...round, color: C.ink }}>Sua viagem</p>
          </div>
          <GentleBadge tone={st.tone}>{st.label}</GentleBadge>
        </div>

        {debt.summary.settled ? (
          <p className="text-[15px]" style={{ color: C.soft }}>Vocês chegaram ao destino juntos. 🎉</p>
        ) : (
          <>
            <TripTrail pct={pct} settled={false} />
            <div className="flex items-baseline justify-between mt-3.5">
              <span className="text-[13px]" style={{ color: C.soft }}>Ainda falta</span>
              <span className="text-[22px] font-bold" style={{ ...round, color: C.ink }}>{formatBRLSoft(falta)}</span>
            </div>
          </>
        )}
        <p className="text-[13px] mt-3 font-semibold" style={{ color: C.sky }}>Ver a viagem →</p>
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
          <p className="text-[15px] font-semibold" style={{ ...round, color: C.ink }}>Compartilhar localização</p>
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
        <Empty title="Vamos tentar de novo?" subtitle="Abra novamente o convite que seu padrinho enviou." />
      ) : !primary ? (
        <Empty title="Tudo tranquilo por aqui" subtitle="Nenhuma viagem combinada no momento." />
      ) : (
        <TripSummary debt={primary} />
      )}

      <LocationHint />

      <LocationSync />
      <DebtorTabBar />
    </Screen>
  );
}
