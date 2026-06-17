'use client';

import { Shell } from '@/components/Shell';

export default function DashboardPage() {
  return (
    <Shell title="Torre de Controle">
      <div className="bg-surface border border-line rounded-xl p-8 flex items-center justify-center min-h-48">
        <p className="font-mono text-sm text-muted tracking-wider">Conectando à carteira…</p>
      </div>
    </Shell>
  );
}
