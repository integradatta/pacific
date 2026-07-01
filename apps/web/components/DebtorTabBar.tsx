'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Tab bar do app do sobrinho (tema claro). 2 abas: Sua ajuda + Localização.
const TABS = [
  { href: '/me', label: 'Sua ajuda', icon: HomeIcon },
  { href: '/local', label: 'Localização', icon: PinIcon },
];

export function DebtorTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação"
      className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E5E7EB]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-[480px] mx-auto flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px]"
              style={{ color: active ? '#4A7DFF' : '#9CA3AF' }}
            >
              <Icon active={active} />
              <span className="text-[11px] font-semibold" style={{ fontFamily: 'var(--font-dmsans)' }}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#EBF0FF' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
}
function PinIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#EBF0FF' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
