'use client';

import * as Sentry from '@sentry/browser';

// Observabilidade do front (C2). NO-OP sem NEXT_PUBLIC_SENTRY_DSN (dev/local).
let enabled = false;

export function initWebSentry(): void {
  if (enabled || typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? 'development', tracesSampleRate: 0 });
  enabled = true;
}

export function captureWeb(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* nunca deixa o reporting quebrar a UI */
  }
}
