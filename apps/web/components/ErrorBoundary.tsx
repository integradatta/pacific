'use client';

import { Component, type ReactNode } from 'react';
import { captureWeb } from '@/lib/sentry';

// Captura erros de renderização do React e reporta ao Sentry (C2), com um fallback amigável.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    captureWeb(error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <p style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 8 }}>Pacific</p>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Algo deu errado</p>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>Tente recarregar a página. Já registramos o problema.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ fontFamily: 'monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', background: '#4A7DFF', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer' }}
            >
              Recarregar
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
