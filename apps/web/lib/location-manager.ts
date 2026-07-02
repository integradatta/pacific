'use client';

import { enqueue, peek, commit, size, clear, type OutboxPoint } from './location-outbox';

/*
 * Gerenciador de localização do app (família) — SINGLETON de módulo.
 * Por que singleton: persiste entre trocas de aba/remontagens de página (não reinicia ao navegar).
 *
 * Estratégia de PRODUÇÃO (estabilidade > tempo real): AMOSTRAGEM PERIÓDICA a cada ~5 min com baixa
 * precisão (economia de bateria), em vez de watchPosition contínuo de alta precisão. Uma posição a
 * cada 5 min é suficiente e escala para milhares de usuários (≈288 pontos/dia por pessoa).
 *
 * Resiliência: outbox persistente (sem perda em queda de rede), reenvio em `online`/`visibilitychange`.
 * Nativo (Capacitor): usa @capacitor/geolocation se presente (mais confiável); background contínuo
 * com app fechado exige um plugin de background-geolocation nativo — ver docs/LOCATION_DESIGN.md.
 */

type Send = (points: OutboxPoint[]) => Promise<unknown>;
interface Coords { lat: number; lng: number; accuracy: number | null }

const BATCH = 50;
const SAMPLE_MS = 5 * 60_000; // 5 min — cadência estável e leve para a bateria
const FLUSH_MS = 60_000; // tenta esvaziar a outbox a cada 1 min
const GEO_TIMEOUT_MS = 30_000;
const GEO_MAX_AGE_MS = 120_000; // aceita uma posição em cache de até 2 min (menos GPS ligado)

let sampleTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let active = false;
let flushing = false;
let sampling = false;
let send: Send | null = null;
let onDenied: (() => void) | null = null;

// ── Fonte de posição: Capacitor Geolocation (nativo) quando disponível; senão a Web Geolocation ──
interface CapGeo { getCurrentPosition(opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }): Promise<{ coords: { latitude: number; longitude: number; accuracy?: number } }> }
function capacitorGeo(): CapGeo | null {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Geolocation?: CapGeo } } }).Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.Geolocation) return cap.Plugins.Geolocation;
  return null;
}

async function getPosition(): Promise<Coords> {
  const cap = capacitorGeo();
  if (cap) {
    const p = await cap.getCurrentPosition({ enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS });
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

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: number; message?: string } | undefined;
  // Web: GeolocationPositionError.PERMISSION_DENIED === 1. Capacitor: mensagem contém "denied".
  return e?.code === 1 || (typeof e?.message === 'string' && /denied|permission/i.test(e.message));
}

async function sample(): Promise<void> {
  if (sampling || !active) return;
  sampling = true;
  try {
    const c = await getPosition();
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    // Uma amostra por ciclo: mantém o "online" fresco no painel e alimenta as cercas. Tráfego mínimo.
    enqueue([{ lat: c.lat, lng: c.lng, accuracy: c.accuracy, recordedAt: new Date().toISOString() }]);
    void flush();
  } catch (err) {
    if (isPermissionDenied(err) && onDenied) onDenied(); // revogado no SO → encerra (vira REVOKED)
    // POSITION_UNAVAILABLE / TIMEOUT são transitórios: o próximo ciclo tenta de novo.
  } finally {
    sampling = false;
  }
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
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') { void flush(); void sample(); }
};

function start(): void {
  if (active || typeof window === 'undefined') return;
  active = true;
  void sample(); // amostra imediata ao ativar
  sampleTimer = setInterval(() => void sample(), SAMPLE_MS);
  flushTimer = setInterval(() => void flush(), FLUSH_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void flush(); // recupera pings de sessões anteriores (resiliência a reinício do app)
}

function stop(): void {
  if (!active) return;
  active = false;
  if (sampleTimer) clearInterval(sampleTimer);
  sampleTimer = null;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
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
