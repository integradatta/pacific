'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useIntelligence, useKpis } from '@/lib/hooks';
import { ExecutiveReport } from '@/components/ExecutiveReport';

export default function RelatorioPage() {
  const intel = useIntelligence();
  const kpis = useKpis();
  const [busy, setBusy] = useState(false);

  async function downloadPng() {
    const el = document.getElementById('executive-report');
    if (!el) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `pacific-resumo-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-3xl mx-auto mb-5 flex items-center justify-between gap-4 no-print">
        <Link href="/dashboard" className="font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest">← Dashboard</Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="font-mono text-[11px] uppercase tracking-widest bg-sonar text-ink font-semibold px-4 py-2 rounded-lg hover:brightness-110 active:translate-y-px transition-all"
          >
            Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={downloadPng}
            disabled={busy || !intel.data}
            className="font-mono text-[11px] uppercase tracking-widest border border-line text-text px-4 py-2 rounded-lg hover:border-sonar/50 disabled:opacity-50 transition-all"
          >
            {busy ? 'Gerando…' : 'Baixar PNG'}
          </button>
        </div>
      </div>

      {intel.isLoading ? (
        <p className="text-center font-mono text-sm text-muted">Carregando…</p>
      ) : intel.isError || !intel.data ? (
        <p className="text-center font-mono text-sm text-status-red">Não foi possível gerar o resumo.</p>
      ) : (
        <ExecutiveReport intel={intel.data} kpis={kpis.data} />
      )}
    </main>
  );
}
