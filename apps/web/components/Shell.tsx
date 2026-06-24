'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/lib/notifications';
import { LogoutButton } from '@/components/LogoutButton';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Torre de Controle', icon: '⊕' },
  { href: '/operacoes/nova', label: 'Nova Ajuda', icon: '✦' },
  { href: '/devedores', label: 'Sobrinhos', icon: '◍' },
  { href: '/carteira', label: 'Carteira', icon: '◈' },
  { href: '/vencimentos', label: 'Vencimentos', icon: '◷' },
  { href: '/notificacoes', label: 'Notificações', icon: '◎' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙' },
];

interface ShellProps {
  title: string;
  orgCode?: string;
  children: ReactNode;
}

export function Shell({ title, orgCode = 'ORG-000', children }: ShellProps) {
  const pathname = usePathname();
  const notifs = useNotifications();
  const unread = (notifs.data?.items ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen flex">
      {/* Left Rail */}
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex flex-col w-56 shrink-0 glass border-r border-line sticky top-0 h-screen"
      >
        {/* Brand */}
        <div className="px-5 py-6 border-b border-line">
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-sonar" />
            </span>
            torre de controle
          </p>
          <span className="font-display text-lg font-semibold text-text tracking-tight">PACIFIC</span>
        </div>

        {/* Nav Items */}
        <ul className="flex-1 py-4 space-y-0.5 px-2.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] transition-all duration-200 ${
                    isActive
                      ? 'text-sonar bg-sonar/[0.07] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]'
                      : 'text-muted hover:text-text hover:bg-line/40'
                  }`}
                >
                  {/* marcador ativo: barra sonar com glow */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sonar transition-opacity duration-200 ${
                      isActive ? 'opacity-100 shadow-[0_0_10px_0_rgb(var(--sonar)/0.7)]' : 'opacity-0'
                    }`}
                  />
                  <span aria-hidden="true" className={`text-base leading-none transition-colors ${isActive ? '' : 'text-muted group-hover:text-text'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="px-5 py-4 border-t border-line">
          <p className="font-mono text-[9px] text-muted/70 uppercase tracking-[0.18em]">monitorando · tempo real</p>
        </div>
      </nav>

      {/* Mobile Top Bar (narrow screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 glass border-b border-line flex items-center gap-4 px-4 h-12">
        <span className="font-display text-sm font-semibold text-text tracking-tight">PACIFIC</span>
        <nav aria-label="Navegação principal" className="flex gap-1 ml-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`p-2 rounded-md text-base leading-none transition-colors ${
                  isActive ? 'text-sonar' : 'text-muted hover:text-text'
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="glass border-b border-line px-6 py-4 flex items-center justify-between md:mt-0 mt-12 sticky top-0 md:top-0 z-10">
          <h1 className="font-display text-xl font-semibold text-text tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/notificacoes"
              aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
              className="relative w-9 h-9 rounded-full bg-surface2 border border-line flex items-center justify-center text-muted hover:text-sonar hover:border-line-strong transition-colors"
            >
              <span aria-hidden="true" className="text-base leading-none">◎</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-status-red text-ink text-[9px] font-mono font-semibold flex items-center justify-center tabular-nums ring-2 ring-surface shadow-[0_0_10px_-1px_rgb(var(--red)/0.7)]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <span className="font-mono text-xs text-text-dim bg-surface2 border border-line px-2.5 py-1.5 rounded-md tracking-wider uppercase tabular-nums">
              {orgCode}
            </span>
            <div
              aria-label="Usuário"
              className="w-9 h-9 rounded-full bg-surface2 border border-line flex items-center justify-center text-muted text-sm"
            >
              ◉
            </div>
            <LogoutButton />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 animate-rise">
          {children}
        </main>
      </div>
    </div>
  );
}
