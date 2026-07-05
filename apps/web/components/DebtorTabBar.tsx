'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { C, sans, HomeGlyph, LocationGlyph, CofreGlyph, ProfileGlyph } from '@/components/family';

// Navegação do app — família + metas de economia (nada de vigilância/cobrança). 4 abas.
const TABS = [
  { href: '/me', label: 'Início', icon: HomeGlyph },
  { href: '/local', label: 'Localização', icon: LocationGlyph },
  { href: '/viagem', label: 'Cofre', icon: CofreGlyph },
  { href: '/perfil', label: 'Perfil', icon: ProfileGlyph },
];

export function DebtorTabBar() {
  const pathname = usePathname();
  // Portal para o body: a barra é `position: fixed`, mas o Screen envolve o conteúdo num
  // container com `animate-rise` (transform persistente por fill-mode `both`). Um ancestral
  // transformado vira containing block do `fixed` → a barra colaria no rodapé do container
  // curto (meio da tela) em vez da viewport. Renderizar fora dessa subárvore resolve.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <nav
      aria-label="Navegação"
      className="fixed bottom-0 inset-x-0 z-30"
      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-[480px] mx-auto flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[58px] transition-colors"
              style={{ color: active ? C.coral : C.faint }}
            >
              <Icon active={active} />
              <span className="text-[11px] font-semibold" style={sans}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>,
    document.body,
  );
}
