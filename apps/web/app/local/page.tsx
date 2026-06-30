'use client';

import { useState } from 'react';
import { useMyConsent, useSetMyConsent } from '@/lib/debtor-location';
import { DebtorTabBar } from '@/components/DebtorTabBar';
import { LocationSync } from '@/components/LocationSync';

const sans = { fontFamily: 'var(--font-dmsans)' } as const;
const CARD = 'bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]';
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
    // Dispara o pedido de permissão do SO; só marca GRANTED se o usuário permitir.
    navigator.geolocation.getCurrentPosition(
      () => setConsent.mutate({ state: 'GRANTED', consentText: CONSENT_TEXT }),
      () => setPermDenied(true),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#111827]" style={{ ...sans, paddingBottom: 'calc(env(safe-area-inset-bottom) + 84px)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-[480px] mx-auto px-4 pt-8 space-y-5 animate-rise">
        <header className="px-1">
          <p className="text-[15px] text-[#6B7280]">Compartilhamento</p>
          <h1 className="text-[30px] font-bold text-[#111827] tracking-tight" style={sans}>Localização</h1>
        </header>

        {consent.isLoading ? (
          <div className={`${CARD} p-6`}><div className="h-24 bg-[#EEF1F5] animate-pulse rounded-[12px]" /></div>
        ) : permDenied ? (
          // Permissão negada no aparelho — sem urgência, usuário no controle.
          <section className={`${CARD} p-6 text-center`}>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: '#EEF1F5' }}>
              <PinOff />
            </div>
            <h2 className="text-[20px] font-bold text-[#111827] mt-4" style={sans}>Localização desativada</h2>
            <p className="text-[15px] text-[#6B7280] mt-1.5">Para compartilhar, permita o acesso à localização nas configurações do seu aparelho e tente de novo.</p>
            <button type="button" onClick={enable} className="mt-5 w-full text-white text-[15px] font-semibold rounded-[12px] py-3.5" style={{ background: '#4A7DFF', boxShadow: '0 2px 8px rgba(74,125,255,0.3)' }}>Tentar novamente</button>
          </section>
        ) : state === 'GRANTED' ? (
          <>
            {/* Estado ON */}
            <section className="rounded-[16px] p-6 border-2" style={{ background: '#E6F9F0', borderColor: '#34C97B' }}>
              <div className="flex items-center gap-3">
                <span className="relative flex w-3 h-3">
                  <span className="absolute inline-flex w-full h-full rounded-full animate-ping2" style={{ background: 'rgba(52,201,123,0.5)' }} />
                  <span className="relative inline-flex w-3 h-3 rounded-full" style={{ background: '#34C97B' }} />
                </span>
                <p className="text-[17px] font-semibold" style={{ color: '#1E9E5A' }}>Compartilhando minha localização</p>
              </div>
              <p className="text-[15px] mt-2" style={{ color: '#2A7D4F' }}>Apenas o seu padrinho pode ver. Você pode parar quando quiser, nas configurações abaixo.</p>
            </section>

            {/* Configurações — único lugar para desligar */}
            <section className={`${CARD} p-5`}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-3">Configurações</p>
              <button
                type="button" onClick={() => { if (window.confirm('Parar de compartilhar sua localização?')) setConsent.mutate({ state: 'REVOKED' }); }}
                disabled={setConsent.isPending}
                className="w-full text-[15px] font-semibold rounded-[12px] py-3.5 border-2 disabled:opacity-50 transition-all"
                style={{ borderColor: '#E5E7EB', color: '#6B7280', background: '#EEF1F5' }}
              >
                {setConsent.isPending ? 'Salvando…' : 'Parar de compartilhar'}
              </button>
            </section>
          </>
        ) : (
          // Opt-in voluntário (NEVER / DECLINED / REVOKED)
          <section className={`${CARD} p-6`}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#EBF0FF' }}>
              <PinOn />
            </div>
            <h2 className="text-[20px] font-bold text-[#111827] mt-4" style={sans}>Compartilhar localização</h2>
            <p className="text-[15px] text-[#6B7280] mt-1.5 leading-relaxed">
              Você pode compartilhar sua localização com o seu padrinho. É <span className="text-[#111827]">voluntário</span>, só ele vê, e você pode
              <span className="text-[#111827]"> desligar quando quiser</span> nas configurações.
            </p>
            <button type="button" onClick={enable} disabled={setConsent.isPending} className="mt-5 w-full text-white text-[15px] font-semibold rounded-[12px] py-3.5 disabled:opacity-50" style={{ background: '#4A7DFF', boxShadow: '0 2px 8px rgba(74,125,255,0.3)' }}>
              Compartilhar localização
            </button>
            <button
              type="button" onClick={() => setConsent.mutate({ state: 'DECLINED' })} disabled={setConsent.isPending}
              className="mt-2 w-full text-[15px] font-medium rounded-[12px] py-3 disabled:opacity-50"
              style={{ color: '#6B7280' }}
            >
              Agora não
            </button>
          </section>
        )}
      </div>
      <LocationSync />
      <DebtorTabBar />
    </main>
  );
}

function PinOn() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A7DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function PinOff() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 .6-2.8" />
      <path d="M8.5 4.2A7 7 0 0 1 19 10c0 2-1 4-2.4 5.8" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
