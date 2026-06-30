import * as Sentry from '@sentry/node';

// Observabilidade (C2): captura de exceções no Sentry. NO-OP sem SENTRY_DSN (dev/local não dependem).
let enabled = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0, // só erros por enquanto (sem APM/tracing)
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
  });
  enabled = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* nunca deixa o reporting derrubar a request */
  }
}

export const sentryEnabled = (): boolean => enabled;
