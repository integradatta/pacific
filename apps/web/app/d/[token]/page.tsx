'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exchangeLink } from '@/lib/debtor';

// Tela de entrada pelo link mágico — tema claro/family-friendly, igual ao app do sobrinho (/me).
export default function DebtorLinkPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    exchangeLink(params.token)
      .then(() => active && router.replace('/me'))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [params.token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#F7F8FA]" style={{ fontFamily: 'var(--font-dmsans)' }}>
      <div className="text-center space-y-3 animate-rise max-w-[340px]">
        <p className="text-[12px] text-[#9CA3AF] uppercase tracking-[0.18em] font-semibold">Pacific</p>
        {error ? (
          <div className="space-y-1.5">
            <p className="text-[17px] font-semibold text-[#111827]" role="alert">Link expirado</p>
            <p className="text-[15px] text-[#6B7280]">Peça um novo link ao seu padrinho para acessar.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 justify-center">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full animate-ping2" style={{ background: 'rgba(74,125,255,0.5)' }} />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full" style={{ background: '#4A7DFF' }} />
            </span>
            <p className="text-[15px] text-[#6B7280]">Abrindo sua ajuda…</p>
          </div>
        )}
      </div>
    </main>
  );
}
