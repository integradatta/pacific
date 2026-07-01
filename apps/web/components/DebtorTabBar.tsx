'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { C, sans, HomeGlyph, LocationGlyph, TripGlyph, ProfileGlyph } from '@/components/family';

// Navegação do app do sobrinho — rede de confiança (nada de vigilância). 4 abas.
const TABS = [
  { href: '/me', label: 'Início', icon: HomeGlyph },
  { href: '/local', label: 'Localização', icon: LocationGlyph },
  { href: '/viagem', label: 'Viagem', icon: TripGlyph },
  { href: '/perfil', label: 'Perfil', icon: ProfileGlyph },
];

export function DebtorTabBar() {
  const pathname = usePathname();
  return (
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
    </nav>
  );
}
