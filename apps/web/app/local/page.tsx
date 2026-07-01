'use client';

import { useState } from 'react';
import { useMyConsent, useSetMyConsent } from '@/lib/debtor-location';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';
import { C, round, sans, Screen, Header, Card, SectionTitle, LocationGlyph } from '@/components/family';

const CONSENT_TEXT = 'v1 — compartilhamento voluntário e revogável a qualquer momento nas configurações';

export default function LocalPage() {
  const consent = useMyConsent();
  const setConsent = useSetMyConsent();
  const [permDenied, setPermDenied] = useState(false);
  const state = consent.data?.state ?? 'NEVER';

  function enable() {
    setPermDenied(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setConsent.mutate({ state: 'GRANTED', consentText: CONSENT_TEXT }),
      () => setPermDenied(true),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <Screen>
      <Header eyebrow="Rede de confiança" title="Localização" />

      {consent.isLoading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 160, background: '#EFE9E1' }} />
      ) : permDenied ? (
        <Card pad="p-6" className="text-center">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full" style={{ background: C.line, color: C.faint }}><LocationGlyph active={false} /></span>
          <h2 className="text-[20px] font-bold mt-4" style={{ ...round, color: C.ink }}>Ative a localização no aparelho</h2>
          <p className="text-[14.5px] mt-1.5" style={{ color: C.soft }}>Para compartilhar com seu padrinho, permita o acesso à localização nas configurações do celular e tente de novo.</p>
          <button type="button" onClick={enable} className="mt-5 w-full text-white text-[16px] font-semibold rounded-[16px] py-3.5" style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})` }}>Tentar de novo</button>
        </Card>
      ) : state === 'GRANTED' ? (
        <>
          <section className="rounded-[22px] p-6" style={{ background: C.mintSoft, border: `1.5px solid ${C.mint}` }}>
            <div className="flex items-center gap-3">
              <span className="relative flex w-3 h-3">
                <span className="absolute inline-flex w-full h-full rounded-full animate-ping2" style={{ background: 'rgba(47,185,138,0.5)' }} />
                <span className="relative inline-flex w-3 h-3 rounded-full" style={{ background: C.mint }} />
              </span>
              <p className="text-[17px] font-semibold" style={{ ...round, color: '#1E8B63' }}>Vocês estão conectados 💚</p>
            </div>
            <p className="text-[14.5px] mt-2 leading-relaxed" style={{ color: '#2A7D57' }}>Seu padrinho pode ver sua localização — só ele. Você pode parar quando quiser, aqui embaixo.</p>
          </section>

          <Card>
            <SectionTitle>Você está no controle</SectionTitle>
            <button
              type="button"
              onClick={() => { if (window.confirm('Parar de compartilhar sua localização?')) setConsent.mutate({ state: 'REVOKED' }); }}
              disabled={setConsent.isPending}
              className="w-full text-[15px] font-semibold rounded-[16px] py-3.5 disabled:opacity-50 transition-all"
              style={{ ...sans, border: `1.5px solid ${C.line}`, color: C.soft, background: C.bg }}
            >
              {setConsent.isPending ? 'Salvando…' : 'Parar de compartilhar'}
            </button>
          </Card>
        </>
      ) : (
        <>
          <Card pad="p-6">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full animate-floaty" style={{ background: C.coralSoft, color: C.coral }}><LocationGlyph active /></span>
            <h2 className="text-[21px] font-bold mt-4" style={{ ...round, color: C.ink }}>Compartilhar com seu padrinho</h2>
            <p className="text-[14.5px] mt-2 leading-relaxed" style={{ color: C.soft }}>
              É como estar de mãos dadas à distância. <b style={{ color: C.ink }}>Só o seu padrinho</b> vê, é <b style={{ color: C.ink }}>totalmente voluntário</b>, e você pode <b style={{ color: C.ink }}>desligar quando quiser</b>.
            </p>
            <button type="button" onClick={enable} disabled={setConsent.isPending} className="mt-5 w-full text-white text-[16px] font-semibold rounded-[16px] py-3.5 disabled:opacity-50" style={{ ...round, background: `linear-gradient(135deg, ${C.sky}, ${C.mint})`, boxShadow: '0 6px 16px -6px rgba(91,156,246,0.5)' }}>
              Começar a compartilhar
            </button>
            <button type="button" onClick={() => setConsent.mutate({ state: 'DECLINED' })} disabled={setConsent.isPending} className="mt-2 w-full text-[15px] font-medium rounded-[16px] py-3 disabled:opacity-50" style={{ color: C.soft }}>
              Agora não
            </button>
          </Card>

          <Card className="flex items-start gap-3">
            <span className="text-[22px]" aria-hidden>🤝</span>
            <p className="text-[13.5px] leading-relaxed" style={{ color: C.soft }}>Isso existe pra aproximar quem cuida de você — nunca pra vigiar. A escolha é sempre sua.</p>
          </Card>
        </>
      )}

      <LocationSync />
      <DebtorTabBar />
    </Screen>
  );
}
