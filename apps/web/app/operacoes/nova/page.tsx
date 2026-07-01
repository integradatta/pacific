'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/Shell';
import { apiPost } from '@/lib/api';
import { formatBRL, venceEm } from '@/lib/format';
import { RiskBadge } from '@/components/RiskBadge';
import { TagInput } from '@/components/Tags';

// Resultado da prévia — calculado no SERVIDOR (o motor proprietário não vai no bundle do client).
interface PreviewResult {
  finalValue: string;
  totalInterest: string;
  profitabilityPct: number;
  expectedReturn: string;
  daysRemaining: number;
  recoverability: number;
}

const inputClass =
  'w-full bg-surface2 border border-line rounded-lg px-3.5 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-sonar focus:shadow-glow transition-all';
const labelClass = 'block font-mono text-xs text-muted uppercase tracking-wider';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

export default function NovaOperacaoPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [ratePct, setRatePct] = useState('');
  const [ratePeriod, setRatePeriod] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [startDate, setStartDate] = useState(todayISO()); // padrão hoje; permite passado (dívidas antigas)
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Taxa digitada em % → fração que o motor financeiro espera (5 → "0.05").
  const rateFraction = useMemo(() => {
    const n = Number(ratePct);
    return Number.isFinite(n) ? String(n / 100) : '0';
  }, [ratePct]);

  // Entrada da prévia (válida ou null). O cálculo roda no SERVIDOR (POST /debts/preview).
  const previewInput = useMemo(() => {
    const p = Number(principal);
    if (!principal || !dueDate || !Number.isFinite(p) || p <= 0) return null;
    return { principal: String(p), rate: rateFraction, ratePeriod, startDate: startDate ? new Date(startDate).toISOString() : undefined, dueDate: new Date(dueDate).toISOString() };
  }, [principal, dueDate, startDate, rateFraction, ratePeriod]);

  // Debounce — não chama a API a cada tecla.
  const [debounced, setDebounced] = useState<typeof previewInput>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(previewInput), 400);
    return () => clearTimeout(t);
  }, [previewInput]);

  const previewQuery = useQuery({
    queryKey: ['debt-preview', debounced],
    enabled: !!debounced,
    queryFn: () => apiPost<PreviewResult>('/debts/preview', debounced),
    staleTime: 60_000,
  });
  const preview = previewQuery.data ?? null;
  const recoverability = preview?.recoverability ?? null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost('/debts/quick', {
        clientName,
        principal: String(Number(principal)),
        rate: rateFraction,
        ratePeriod,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: new Date(dueDate).toISOString(),
        tags,
      });
      router.push('/carteira');
    } catch {
      setError('Não foi possível salvar a operação. Verifique os dados e tente novamente.');
      setLoading(false);
    }
  }

  return (
    <Shell title="Nova Ajuda">
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {/* Formulário */}
        <form onSubmit={handleSubmit} className="panel p-6 space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="clientName" className={labelClass}>Nome do cliente</label>
            <input id="clientName" required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex.: João da Silva" className={inputClass} />
          </div>

          <div className="space-y-1">
            <label htmlFor="principal" className={labelClass}>Valor da dívida (R$)</label>
            <input id="principal" type="number" inputMode="decimal" min="0" step="0.01" required value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0,00" className={inputClass} />
          </div>

          <div className="space-y-1">
            <label htmlFor="ratePct" className={labelClass}>Taxa de gratidão (%)</label>
            <div className="flex gap-2">
              <input id="ratePct" type="number" inputMode="decimal" min="0" step="0.01" required value={ratePct} onChange={(e) => setRatePct(e.target.value)} placeholder="Ex.: 5" className={inputClass} />
              <div className="flex rounded-lg border border-line overflow-hidden shrink-0" role="group" aria-label="Período da taxa">
                {(['MONTHLY', 'ANNUAL'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRatePeriod(p)}
                    aria-pressed={ratePeriod === p}
                    className={`px-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${ratePeriod === p ? 'bg-sonar text-ink' : 'bg-surface2 text-muted hover:text-text'}`}
                  >
                    {p === 'MONTHLY' ? 'mês' : 'ano'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="startDate" className={labelClass}>Data inicial</label>
              <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              <p className="font-sans text-[11px] text-muted">Pode ser no passado (dívidas antigas).</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="dueDate" className={labelClass}>Vencimento</label>
              <input id="dueDate" type="date" required min={startDate || undefined} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1">
            <span className={labelClass}>Etiquetas <span className="text-muted/60 normal-case tracking-normal">(opcional)</span></span>
            <TagInput value={tags} onChange={setTags} />
          </div>

          {error && <p role="alert" className="font-mono text-xs text-status-red">{error}</p>}

          <button
            type="submit"
            disabled={loading || !preview || clientName.trim() === ''}
            className="w-full bg-sonar text-ink font-mono text-sm font-semibold uppercase tracking-widest py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          >
            {loading ? 'Salvando…' : 'Cadastrar operação'}
          </button>
        </form>

        {/* Projeção em tempo real */}
        <div className="panel p-6 self-start">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">Projeção da operação</p>
            {recoverability !== null && <RiskBadge recoverability={recoverability} />}
          </div>
          {!preview ? (
            <p className="font-sans text-sm text-muted">
              Preencha <span className="text-text">valor</span>, <span className="text-text">taxa</span> e{' '}
              <span className="text-text">vencimento</span> para ver os cálculos em tempo real.
            </p>
          ) : (
            <dl className="space-y-3">
              <PreviewRow label="Valor final" value={formatBRL(preview.finalValue)} strong />
              <PreviewRow label="Gratidão total" value={formatBRL(preview.totalInterest)} />
              <PreviewRow label="Rentabilidade" value={`${preview.profitabilityPct.toLocaleString('pt-BR')}%`} accent />
              <PreviewRow label="Retorno esperado" value={formatBRL(preview.expectedReturn)} />
              <PreviewRow label="Dias restantes" value={venceEm(preview.daysRemaining)} />
            </dl>
          )}
        </div>
      </div>
    </Shell>
  );
}

function PreviewRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/50 pb-2 last:border-0">
      <dt className="font-mono text-xs text-muted uppercase tracking-wider">{label}</dt>
      <dd className={`font-display tabular-nums ${strong ? 'text-lg text-text font-semibold' : accent ? 'text-sonar font-medium' : 'text-text'}`}>
        {value}
      </dd>
    </div>
  );
}
