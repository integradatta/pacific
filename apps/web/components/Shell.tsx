'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Torre de Controle', icon: '⊕' },
  { href: '/devedores', label: 'Devedores', icon: '◍' },
  { href: '/carteira', label: 'Carteira', icon: '◈' },
  { href: '/vencimentos', label: 'Vencimentos', icon: '◷' },
  { href: '/notificacoes', label: 'Notificações', icon: '◎' },
];

interface ShellProps {
  title: string;
  orgCode?: string;
  children: ReactNode;
}

export function Shell({ title, orgCode = 'ORG-000', children }: ShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ink flex">
      {/* Left Rail */}
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex flex-col w-56 shrink-0 bg-surface border-r border-line"
      >
        {/* Brand */}
        <div className="px-5 py-6 border-b border-line">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-0.5">torre de controle</p>
          <span className="font-display text-lg font-semibold text-text tracking-tight">PACIFIC</span>
        </div>

        {/* Nav Items */}
        <ul className="flex-1 py-4 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-sonar border-l-2 ${
                    isActive
                      ? 'border-sonar text-sonar bg-sonar/5'
                      : 'border-transparent text-muted hover:text-text hover:bg-line/50'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile Top Bar (narrow screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-surface border-b border-line flex items-center gap-4 px-4 h-12">
        <span className="font-display text-sm font-semibold text-text">PACIFIC</span>
        <nav aria-label="Navegação principal" className="flex gap-1 ml-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`p-2 rounded-md text-base leading-none focus:outline-none focus:ring-2 focus:ring-sonar transition-colors ${
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
        <header className="bg-surface border-b border-line px-6 py-4 flex items-center justify-between md:mt-0 mt-12">
          <h1 className="font-display text-xl font-semibold text-text">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted bg-line px-2.5 py-1 rounded-md tracking-wider uppercase">
              {orgCode}
            </span>
            <div
              aria-label="Usuário"
              className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-muted text-sm"
            >
              ◉
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
