'use client';

import { enqueue, peek, commit, clear, type OutboxPoint } from './location-outbox';

/*
 * Gerenciador de localização do app (família) — SINGLETON de módulo.
 * Por que singleton: persiste entre trocas de aba/remontagens de página (não reinicia ao navegar).
 *
 * Estratégia de PRODUÇÃO (estabilidade > tempo real):
 *  - NATIVO (Capacitor + @capacitor-community/background-geolocation): watcher com foreground service
 *    e NOTIFICAÇÃO PERSISTENTE VISÍVEL — funciona com o app em segundo plano / tela bloqueada.
 *    Nada oculto: o usuário sempre vê "Pacific está compartilhando sua localização".
 *  - WEB/PWA (foreground): amostragem periódica a cada ~5 min, baixa precisão (bateria).
 * Em ambos, throttle para ~1 ponto a cada 5 min: leve para bateria e escalável (≈288 pontos/dia/pessoa).
 *
 * Resiliência: outbox persistente (sem perda em queda de rede), reenvio em `online`/`visibilitychange`,
 * revogação de permissão do SO encerra o compartilhamento.
 *
 * Sem import estático dos plugins nativos: usamos o bridge do Capacitor em runtime, para o bundle web
 * não depender deles (feature-detect + try/catch → nunca quebra no navegador).
 */

type Send = (points: OutboxPoint[]) => Promise<unknown>;
interface Coords { lat: number; lng: number; accuracy: number | null }

const BATCH = 50;
const SAMPLE_MS = 5 * 60_000; // 5 min — cadência estável e leve para a bateria
const FLUSH_MS = 60_000; // tenta esvaziar a outbox a cada 1 min
const GEO_TIMEOUT_MS = 30_000;
const GEO_MAX_AGE_MS = 120_000; // aceita posição em cache de até 2 min (menos GPS ligado)
const BG_DISTANCE_FILTER_M = 25; // no nativo, só reporta quando move ≥ isto (economia)

let sampleTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let watcherId: string | null = null;
let lastEnqueuedAt = 0;
let active = false;
let flushing = false;
let sampling = false;
let send: Send | null = null;
let onDenied: (() => void) | null = null;

// ── Bridges do Capacitor (runtime; ausentes no navegador) ────────────────────
interface CapGeo { getCurrentPosition(opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }): Promise<{ coords: { latitude: number; longitude: number; accuracy?: number } }> }
interface BgLoc { latitude: number; longitude: number; accuracy?: number }
interface BgErr { code?: string; message?: string }
interface BgPlugin {
  addWatcher(opts: { backgroundTitle?: string; backgroundMessage?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number }, cb: (loc?: BgLoc, err?: BgErr) => void): Promise<string>;
  removeWatcher(opts: { id: string }): Promise<void>;
}
type Cap = { isNativePlatform?: () => boolean; Plugins?: { Geolocation?: CapGeo; BackgroundGeolocation?: BgPlugin } };
function cap(): Cap | undefined { return (globalThis as { Capacitor?: Cap }).Capacitor; }
function isNative(): boolean { return cap()?.isNativePlatform?.() === true; }

function enqueueCoords(c: Coords, now = Date.now()): void {
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
  // Throttle: no máx. 1 ponto a cada SAMPLE_MS (mantém o "online" fresco sem inundar). Tráfego mínimo.
  if (lastEnqueuedAt && now - lastEnqueuedAt < SAMPLE_MS) return;
  lastEnqueuedAt = now;
  enqueue([{ lat: c.lat, lng: c.lng, accuracy: c.accuracy, recordedAt: new Date(now).toISOString() }]);
  void flush();
}

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string } | undefined;
  // Web: GeolocationPositionError.PERMISSION_DENIED === 1. Nativo: code/mensagem com "denied"/"NOT_AUTHORIZED".
  return e?.code === 1 || (typeof e?.code === 'string' && /denied|not_authorized/i.test(e.code)) || (typeof e?.message === 'string' && /denied|permission/i.test(e.message));
}

// ── Fonte WEB: getCurrentPosition periódico (foreground) ─────────────────────
async function getWebPosition(): Promise<Coords> {
  const g = cap()?.Plugins?.Geolocation;
  if (g) {
    const p = await g.getCurrentPosition({ enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy!) : null };
  }
  return new Promise<Coords>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('sem geolocalização')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS },
    );
  });
}

async function sampleWeb(): Promise<void> {
  if (sampling || !active) return;
  sampling = true;
  try {
    enqueueCoords(await getWebPosition());
  } catch (err) {
    if (isPermissionDenied(err) && onDenied) onDenied(); // revogado no SO → encerra (vira REVOKED)
    // POSITION_UNAVAILABLE / TIMEOUT são transitórios: o próximo ciclo tenta de novo.
  } finally {
    sampling = false;
  }
}

// ── Fonte NATIVA: watcher em segundo plano com notificação persistente ───────
async function startNative(bg: BgPlugin): Promise<void> {
  try {
    watcherId = await bg.addWatcher(
      {
        backgroundTitle: 'Pacific',
        backgroundMessage: 'Compartilhando sua localização com a família',
        requestPermissions: true,
        stale: false,
        distanceFilter: BG_DISTANCE_FILTER_M,
      },
      (loc, err) => {
        if (err) { if (isPermissionDenied(err) && onDenied) onDenied(); return; }
        if (!loc) return;
        enqueueCoords({ lat: loc.latitude, lng: loc.longitude, accuracy: Number.isFinite(loc.accuracy) ? Math.round(loc.accuracy!) : null });
      },
    );
  } catch {
    // Plugin indisponível/erro → cai para o sampler web (foreground).
    startWebSampler();
  }
}

function startWebSampler(): void {
  if (sampleTimer) return;
  void sampleWeb(); // amostra imediata
  sampleTimer = setInterval(() => void sampleWeb(), SAMPLE_MS);
}

async function flush(): Promise<void> {
  if (flushing || !send || typeof navigator === 'undefined' || navigator.onLine === false) return;
  flushing = true;
  try {
    let batch = peek(BATCH);
    while (batch.length > 0) {
      await send(batch); // throws em falha → mantém na fila p/ retry
      commit(batch.length);
      batch = peek(BATCH);
    }
  } catch {
    /* falha transitória: pontos permanecem na outbox e serão reenviados depois */
  } finally {
    flushing = false;
  }
}

const onOnline = (): void => void flush();
const onVisible = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') { void flush(); if (!isNative()) void sampleWeb(); }
};

function start(): void {
  if (active || typeof window === 'undefined') return;
  active = true;
  lastEnqueuedAt = 0;
  flushTimer = setInterval(() => void flush(), FLUSH_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const bg = isNative() ? cap()?.Plugins?.BackgroundGeolocation : undefined;
  if (bg) void startNative(bg); // nativo: background + notificação persistente
  else startWebSampler(); // web/PWA: foreground periódico
  void flush(); // recupera pings de sessões anteriores (resiliência a reinício do app)
}

function stop(): void {
  if (!active) return;
  active = false;
  if (sampleTimer) clearInterval(sampleTimer);
  sampleTimer = null;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  if (watcherId) { const bg = cap()?.Plugins?.BackgroundGeolocation; void bg?.removeWatcher({ id: watcherId }).catch(() => undefined); watcherId = null; }
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
  // Parou de compartilhar (revogado): pings pendentes não serão aceitos pelo servidor → descarta.
  clear();
}

export const locationManager = {
  /** Sincroniza o desejo (ativo quando consentimento = GRANTED). Idempotente. */
  sync(opts: { active: boolean; send: Send; onPermissionDenied: () => void }): void {
    send = opts.send;
    onDenied = opts.onPermissionDenied;
    if (opts.active) start();
    else stop();
  },
};
