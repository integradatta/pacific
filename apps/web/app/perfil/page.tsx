'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearDebtorJwt } from '@/lib/debtor';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { C, round, sans, Screen, Header, Card, SectionTitle, Avatar, LocationGlyph } from '@/components/family';

// PERFIL — quem é você na rede, atalhos e o botão de sair. Tom acolhedor, sem burocracia.

function Row({ href, onClick, icon, title, subtitle, danger }: { href?: string; onClick?: () => void; icon: ReactNode; title: string; subtitle?: string; danger?: boolean }) {
  const inner = (
    <div className="flex items-center gap-3.5 py-3.5">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0" style={{ background: danger ? C.warmSoft : C.skySoft, color: danger ? C.warm : C.sky }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-semibold" style={{ ...sans, color: danger ? C.warm : C.ink }}>{title}</p>
        {subtitle && <p className="text-[13px] leading-snug" style={{ color: C.soft }}>{subtitle}</p>}
      </div>
      {href && <span style={{ color: C.faint }}>›</span>}
    </div>
  );
  if (href) return <Link href={href} className="block active:opacity-70 transition-opacity">{inner}</Link>;
  return <button type="button" onClick={onClick} className="block w-full text-left active:opacity-70 transition-opacity">{inner}</button>;
}

export default function PerfilPage() {
  const router = useRouter();
  function sair() {
    if (!window.confirm('Deseja sair deste aparelho?')) return;
    clearDebtorJwt();
    router.replace('/');
  }

  return (
    <Screen>
      <Header eyebrow="Você na rede" title="Perfil" />

      <Card className="flex items-center gap-3.5">
        <Avatar name="Você" tone="sky" size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold" style={{ ...round, color: C.ink }}>Você</p>
          <p className="text-[13.5px]" style={{ color: C.soft }}>Faz parte de uma rede de confiança 💛</p>
        </div>
      </Card>

      <Card pad="px-5 py-1">
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <Row href="/local" icon={<LocationGlyph active />} title="Localização" subtitle="Compartilhar com seu padrinho — você no controle" />
        </div>
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <Row icon={<span aria-hidden>💬</span>} title="Ajuda" subtitle="Fale com seu padrinho se tiver qualquer dúvida" />
        </div>
        <Row onClick={sair} icon={<span aria-hidden>👋</span>} title="Sair" danger />
      </Card>

      <Card className="flex items-start gap-3">
        <span className="text-[20px]" aria-hidden>🤝</span>
        <p className="text-[13px] leading-relaxed" style={{ color: C.soft }}>O Pacific é uma rede entre pessoas próximas — pra caminhar junto, com respeito e transparência.</p>
      </Card>

      <DebtorTabBar />
    </Screen>
  );
}
