'use client';

import type { AdminCreditorRow } from '@pacific/shared';

// Assinatura do centro de comando: a plataforma como uma rede de credores. Cada nó é uma carteira
// (raio ∝ √valor a receber), cor pela saúde (ativo/pendente/suspenso). Disposição em espiral de
// ângulo áureo (determinística, distribuição uniforme). Núcleo central = a plataforma.
const GOLDEN = 137.50776; // graus

function color(c: AdminCreditorRow): { fill: string; glow: string } {
  if (c.status === 'SUSPENDED') return { fill: 'rgb(var(--red))', glow: 'rgb(var(--red)/0.7)' };
  if (c.approval === 'PENDING') return { fill: 'rgb(var(--yellow))', glow: 'rgb(var(--yellow)/0.7)' };
  if (c.approval === 'REJECTED') return { fill: 'rgb(var(--muted))', glow: 'rgb(var(--muted)/0.5)' };
  return { fill: 'rgb(var(--iris))', glow: 'rgb(var(--iris)/0.8)' };
}

export function Constellation({ creditors }: { creditors: AdminCreditorRow[] }) {
  const W = 820;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;
  const maxWallet = Math.max(1, ...creditors.map((c) => Number(c.walletValue)));

  const nodes = creditors.map((c, i) => {
    const ang = (i * GOLDEN * Math.PI) / 180;
    const rad = 26 * Math.sqrt(i + 1); // espiral
    const x = Math.max(14, Math.min(W - 14, cx + rad * Math.cos(ang)));
    const y = Math.max(14, Math.min(H - 14, cy + rad * Math.sin(ang) * 0.72)); // achata p/ caber
    const r = 3.5 + 9 * Math.sqrt(Number(c.walletValue) / maxWallet);
    return { c, x, y, r, ...color(c) };
  });

  return (
    <section className="panel p-6 relative overflow-hidden">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Constelação da plataforma</h2>
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.18em] mt-0.5">cada nó é um credor · raio = carteira · cor = saúde</p>
        </div>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{creditors.length} credores</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Mapa de credores da plataforma">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--iris) / 0.18)" />
            <stop offset="100%" stopColor="rgb(var(--iris) / 0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={180} fill="url(#coreGlow)" />
        {/* linhas sutis do núcleo aos nós */}
        {nodes.map((n, i) => (
          <line key={`l-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="rgb(var(--line-strong))" strokeWidth={0.5} opacity={0.5} />
        ))}
        {/* núcleo */}
        <circle cx={cx} cy={cy} r={6} fill="rgb(var(--iris))" />
        <circle cx={cx} cy={cy} r={6} fill="none" stroke="rgb(var(--iris) / 0.5)" strokeWidth={1}>
          <animate attributeName="r" values="6;16;6" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* nós */}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.fill} style={{ filter: `drop-shadow(0 0 6px ${n.glow})` }}>
            <title>{`${n.c.name} · ${n.c.approval}/${n.c.status} · a receber ${Number(n.c.walletValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</title>
          </circle>
        ))}
      </svg>

      {/* legenda */}
      <div className="flex gap-4 mt-2 flex-wrap">
        {[
          { c: 'bg-iris', l: 'ativo' },
          { c: 'bg-status-yellow', l: 'pendente' },
          { c: 'bg-status-red', l: 'suspenso' },
        ].map((x) => (
          <span key={x.l} className="font-mono text-[10px] text-muted uppercase tracking-wider flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${x.c}`} /> {x.l}
          </span>
        ))}
      </div>
    </section>
  );
}
