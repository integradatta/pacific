'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exchangeLink } from '@/lib/debtor';

export default function DebtorLinkPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    exchangeLink(params.token)
      .then(() => active && router.replace('/me'))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [params.token, router]);

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center space-y-2">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest">Pacific</p>
        {error ? (
          <p className="font-mono text-sm text-status-red" role="alert">
            Link inválido ou expirado. Peça um novo ao seu credor.
          </p>
        ) : (
          <p className="font-mono text-sm text-muted tracking-wider animate-pulse">Entrando…</p>
        )}
      </div>
    </main>
  );
}
