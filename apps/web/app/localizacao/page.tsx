'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Shell } from '@/components/Shell';
import { usePositions, useDeclines, useGeofences, useCreateGeofence, useDeleteGeofence, useDebtorTrack } from '@/lib/location';
import { ListSkeleton } from '@/components/Skeleton';

// Mapa só no cliente (react-leaflet não suporta SSR).
const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface2 animate-pulse" />,
});

const fmtRel = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export default function LocalizacaoPage() {
  const positions = usePositions();
  const declines = useDeclines();
  const geofences = useGeofences();
  const createGeofence = useCreateGeofence();
  const deleteGeofence = useDeleteGeofence();
  const [addMode, setAddMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const track = useDebtorTrack(selected);

  const sharing = positions.data ?? [];
  const declined = declines.data ?? [];
  const fences = geofences.data ?? [];

  function handleAddAt(lat: number, lng: number) {
    const label = window.prompt('Nome do local (ex.: Casa, Trabalho):');
    if (!label?.trim()) return;
    const r = window.prompt('Raio em metros:', '200');
    const radiusM = Number(r);
    if (!Number.isFinite(radiusM) || radiusM < 10) return;
    createGeofence.mutate({ label: label.trim(), lat, lng, radiusM }, { onSettled: () => setAddMode(false) });
  }

  return (
    <Shell title="Localização">
      <div className="space-y-4">
        {/* Notificação: recusas de compartilhamento */}
        {declined.length > 0 && (
          <section className="panel overflow-hidden border-status-yellow/40">
            <div className="px-6 py-3.5 border-b border-line flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-status-yellow">Recusaram compartilhar localização</h2>
              <span className="font-mono text-[10px] text-muted tabular-nums">{declined.length}</span>
            </div>
            <ul className="divide-y divide-line/70">
              {declined.map((d) => (
                <li key={d.debtorId} className="px-6 py-2.5 flex items-center justify-between gap-3">
                  <span className="font-sans text-sm text-text">{d.debtorName}</span>
                  <span className="font-mono text-[11px] text-muted tabular-nums">{d.declinedAt ? fmtRel(d.declinedAt) : '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Mapa */}
          <section className="panel overflow-hidden lg:col-span-2">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-text tracking-tight">Mapa</h2>
              <button
                type="button" onClick={() => setAddMode((v) => !v)}
                className={`font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 transition-colors ${addMode ? 'text-iris border-iris/50 bg-iris/10' : 'text-muted border-line hover:text-text'}`}
              >
                {addMode ? 'Clique no mapa…' : 'Adicionar cerca'}
              </button>
            </div>
            <div className="h-[460px]">
              <LocationMap positions={sharing} geofences={fences} track={selected ? track.data ?? [] : []} addMode={addMode} onAddAt={handleAddAt} />
            </div>
          </section>

          {/* Lateral: quem compartilha + cercas */}
          <div className="space-y-4">
            <section className="panel overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold text-text tracking-tight">Compartilhando</h2>
                <span className="font-mono text-[10px] text-muted tabular-nums">{sharing.length}</span>
              </div>
              {positions.isLoading ? (
                <div className="p-4"><ListSkeleton rows={3} /></div>
              ) : sharing.length === 0 ? (
                <p className="px-5 py-6 font-sans text-sm text-text-dim">Ninguém está compartilhando a localização no momento.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {sharing.filter((p) => p.battery != null && p.battery <= 20).length > 0 && (
                    <li className="px-5 py-2 flex items-center gap-2" style={{ background: 'rgba(245,166,35,0.08)' }}>
                      <span aria-hidden>🔋</span>
                      <span className="font-sans text-xs text-text-dim">
                        {sharing.filter((p) => p.battery != null && p.battery <= 20).length} com bateria baixa — a localização pode parar.
                      </span>
                    </li>
                  )}
                  {sharing.map((p) => (
                    <li key={p.debtorId} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${p.online ? 'bg-status-green' : 'bg-muted'}`} />
                          <span className="font-sans text-sm text-text truncate">{p.debtorName}</span>
                        </span>
                        <button
                          type="button" onClick={() => setSelected(selected === p.debtorId ? null : p.debtorId)}
                          className={`font-mono text-[10px] uppercase tracking-widest border rounded px-2 py-0.5 shrink-0 transition-colors ${selected === p.debtorId ? 'text-sonar border-sonar/50 bg-sonar/10' : 'text-muted border-line hover:text-text'}`}
                        >
                          {selected === p.debtorId ? 'Ocultar' : 'Trajeto'}
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-muted mt-1 tabular-nums">
                        {p.online ? 'agora' : 'sem atualização recente'} · {fmtRel(p.recordedAt)}
                        {p.battery != null && (
                          <span style={p.battery <= 20 ? { color: '#F5A623' } : undefined}> · 🔋 {p.battery}%{p.battery <= 20 ? ' baixa' : ''}</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold text-text tracking-tight">Locais (cercas)</h2>
                <span className="font-mono text-[10px] text-muted tabular-nums">{fences.length}</span>
              </div>
              {fences.length === 0 ? (
                <p className="px-5 py-5 font-sans text-sm text-text-dim">Nenhum local. Use “Adicionar cerca” e clique no mapa.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {fences.map((g) => (
                    <li key={g.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-sans text-sm text-text truncate">{g.label}</span>
                        <span className="font-mono text-[10px] text-muted ml-2">{g.radiusM} m</span>
                      </span>
                      <button type="button" disabled={deleteGeofence.isPending} onClick={() => deleteGeofence.mutate(g.id)} className="font-mono text-[10px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-2 py-0.5 hover:bg-status-red/10 disabled:opacity-50">Remover</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <p className="font-mono text-[10px] text-muted tracking-wider">
          Mostra apenas devedores que <span className="text-text-dim">consentiram</span> em compartilhar. Posições atualizam a cada 30s.
        </p>
      </div>
    </Shell>
  );
}
