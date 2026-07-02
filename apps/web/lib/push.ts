'use client';

import { apiPost } from './api';

// Web Push (VAPID) do padrinho. Ativa só se NEXT_PUBLIC_VAPID_PUBLIC_KEY estiver setado (no-op sem).

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushConfigured(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export type PushResult = 'enabled' | 'denied' | 'unsupported' | 'error';

export async function enablePush(): Promise<PushResult> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pushConfigured() || !vapid) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource });
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'error';
    await apiPost('/notifications/push-subscription', { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
    return 'enabled';
  } catch {
    return 'error';
  }
}
