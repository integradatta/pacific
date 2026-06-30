'use client';

import { enqueue, peek, commit, size, clear, type OutboxPoint } from './location-outbox';

/*
 * Gerenciador de compartilhamento de localização do sobrinho — SINGLETON de módulo.
 * Por que singleton: persiste entre trocas de aba/remontagens de página (o GPS não reinicia ao
 * navegar entre "Sua ajuda" e "Localização"). Em background contínuo (app fechado) exige plugin
 * nativo (Capacitor) — ver docs/LOCATION_DESIGN.md §0.1; aqui é foreground robusto.
 *
 * Resiliência: outbox persistente (sem perda em queda de rede), reenvio com retomada em
 * `online`/`visibilitychange`, throttle (bateria/tráfego), e revogação de permissão do SO tratada.
 */

type Send = (points: OutboxPoint[]) => Promise<unknown>;

const BATCH = 50;
const FLUSH_MS = 30_000;
const MIN_GAP_MS = 15_000; // intervalo mínimo entre pontos aceitos
const MIN_DIST_M = 20; // ou deslocamento mínimo

let watchId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let active = false;
let flushing = false;
let send: Send | null = null;
let onDenied: (() => void) | null = null;
let last: { t: number; lat: number; lng: number } | null = null;

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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

function onPosition(pos: GeolocationPosition): void {
  const now = Date.now();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  // Throttle: ignora pontos muito próximos no tempo E no espaço (economiza bateria/dados).
  if (last && now - last.t < MIN_GAP_MS && distM(last, { lat, lng }) < MIN_DIST_M) return;
  last = { t: now, lat, lng };
  enqueue([{ lat, lng, accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null, recordedAt: new Date(now).toISOString() }]);
  if (size() >= 5) void flush();
}

function onError(e: GeolocationPositionError): void {
  // Permissão revogada nas configurações do SO → encerra o compartilhamento (vira REVOKED).
  if (e.code === e.PERMISSION_DENIED && onDenied) onDenied();
  // POSITION_UNAVAILABLE / TIMEOUT são transitórios: o watch segue tentando sozinho.
}

const onOnline = (): void => void flush();
const onVisible = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') void flush();
};

function start(): void {
  if (active || typeof navigator === 'undefined' || !navigator.geolocation) return;
  active = true;
  last = null;
  watchId = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 });
  timer = setInterval(() => void flush(), FLUSH_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void flush(); // recupera pings de sessões anteriores (resiliência a reinício do app)
}

function stop(): void {
  if (!active) return;
  active = false;
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (timer) clearInterval(timer);
  timer = null;
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
