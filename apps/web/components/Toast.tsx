'use client';

import { useSyncExternalStore } from 'react';

// Toast leve e sem dependências: store de módulo + useSyncExternalStore. Reutilizável em todo o app
// (ações do admin, aceites, etc.). Chame `toast('Suspenso', 'success')` de qualquer lugar.
export type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  for (const l of listeners) l();
}

export function toast(message: string, tone: ToastTone = 'info'): void {
  const id = ++seq;
  items = [...items, { id, message, tone }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const TONE: Record<ToastTone, { dot: string; ring: string }> = {
  success: { dot: 'bg-status-green', ring: 'border-status-green/40' },
  error: { dot: 'bg-status-red', ring: 'border-status-red/40' },
  info: { dot: 'bg-sonar', ring: 'border-sonar/40' },
};

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-atomic="false">
      {list.map((t) => {
        const tone = TONE[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={`panel ${tone.ring} px-4 py-3 flex items-center gap-2.5 shadow-lg animate-rise pointer-events-auto max-w-[min(90vw,22rem)]`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
            <span className="font-sans text-sm text-text break-words">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
