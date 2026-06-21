'use client';

// Painel INERTE de localização — preparação de arquitetura (etapa GPS).
// Sem mapa real, sem rede, sem rastreamento. Apenas comunica o recurso futuro e a postura ética.
export function LocationPanel() {
  return (
    <section className="panel overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Localização</h2>
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5">módulo opcional</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-status-yellow/40 bg-status-yellow/10 text-status-yellow shrink-0">
          Em desenvolvimento
        </span>
      </div>

      <div className="p-6 space-y-4">
        {/* Pré-visualização inerte (sem mapa/dados reais) */}
        <div
          aria-hidden="true"
          className="h-36 rounded-lg border border-dashed border-line bg-surface2 flex items-center justify-center"
        >
          <span className="font-mono text-xs text-muted">◍ pré-visualização indisponível</span>
        </div>

        <p className="font-sans text-sm text-muted leading-relaxed">
          Recurso <span className="text-text">futuro</span> e <span className="text-text">voluntário</span>: quando
          implementado, exigirá <span className="text-text">consentimento explícito</span> do cliente e usará apenas
          dados <span className="text-text">simulados</span> para fins acadêmicos —{' '}
          <span className="text-text">sem rastreamento real de pessoas</span>.
        </p>

        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Indisponível nesta versão"
          className="font-mono text-[11px] uppercase tracking-widest py-2 px-4 rounded-lg border border-line text-muted opacity-50 cursor-not-allowed"
        >
          Solicitar compartilhamento (voluntário)
        </button>
      </div>
    </section>
  );
}
