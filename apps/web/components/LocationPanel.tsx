'use client';

import Link from 'next/link';
import { usePositions } from '@/lib/location';

// Teaser na tela de Sobrinhos: resume o compartilhamento e leva ao painel de Localização.
// (Substitui o antigo placeholder inerte — agora a feature existe em /localizacao.)
export function LocationPanel() {
  const positions = usePositions();
  const sharing = positions.data?.length ?? 0;

  return (
    <section className="panel overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Localização</h2>
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5">compartilhamento consentido</p>
        </div>
        <Link href="/localizacao" className="font-mono text-[10px] uppercase tracking-widest text-iris border border-iris/40 rounded-lg px-3 py-2 hover:bg-iris/10 transition-colors shrink-0">Abrir mapa →</Link>
      </div>
      <div className="px-6 py-5">
        <p className="font-sans text-sm text-text-dim leading-relaxed">
          {sharing > 0
            ? <><span className="text-text font-medium">{sharing}</span> sobrinho(s) compartilhando a localização agora.</>
            : 'Nenhum sobrinho compartilhando no momento. O compartilhamento é voluntário e revogável.'}
        </p>
      </div>
    </section>
  );
}
