'use client';

import { type ReactNode, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Visão geral', icon: '◈' },
  { href: '/admin/credores', label: 'Credores', icon: '◍' },
  { href: '/admin/aprovacoes', label: 'Aprovações', icon: '✓' },
  { href: '/admin/links', label: 'Links de acesso', icon: '⚷' },
  { href: '/admin/sessoes', label: 'Sessões', icon: '◉' },
  { href: '/admin/monitoramento', label: 'Monitoramento', icon: '◬' },
  { href: '/admin/auditoria', label: 'Auditoria', icon: '◷' },
  { href: '/admin/seguranca', label: 'Segurança', icon: '⊘' },
  { href: '/admin/executivo', label: 'Executivo', icon: '◆' },
];

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');

  function search(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/admin/credores?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="min-h-screen flex">
      <nav aria-label="Navegação do administrador" className="hidden md:flex flex-col w-60 shrink-0 glass border-r border-line sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-line">
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-iris/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-iris" />
            </span>
            centro de comando
          </p>
          <span className="font-display text-lg font-semibold text-text tracking-tight">PACIFIC</span>
          <span className="font-mono text-[10px] text-iris ml-1.5 align-middle">ADMIN</span>
        </div>
        <ul className="flex-1 py-4 space-y-0.5 px-2.5">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] transition-all duration-200 ${
                    active ? 'text-iris bg-iris/[0.08] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]' : 'text-muted hover:text-text hover:bg-line/40'
                  }`}
                >
                  <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-iris transition-opacity ${active ? 'opacity-100 shadow-[0_0_10px_0_rgb(var(--iris)/0.7)]' : 'opacity-0'}`} />
                  <span aria-hidden className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-4 border-t border-line">
          <p className="font-mono text-[9px] text-muted/70 uppercase tracking-[0.18em]">acesso global · plataforma</p>
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-line px-6 py-3.5 flex items-center gap-4 sticky top-0 z-10">
          <h1 className="font-display text-xl font-semibold text-text tracking-tight shrink-0">{title}</h1>
          <form onSubmit={search} className="flex-1 max-w-md ml-auto">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar credores, operações, logs…"
              aria-label="Busca global"
              className="w-full bg-surface2 border border-line rounded-lg px-3.5 py-2 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-iris focus:shadow-[0_0_0_1px_rgb(var(--iris)/0.25),0_0_22px_-2px_rgb(var(--iris)/0.45)] transition-all"
            />
          </form>
          <div aria-label="Administrador" className="w-9 h-9 rounded-full bg-iris/15 border border-iris/40 flex items-center justify-center text-iris text-sm shrink-0">◉</div>
        </header>
        <main className="flex-1 p-6 animate-rise">{children}</main>
      </div>
    </div>
  );
}
