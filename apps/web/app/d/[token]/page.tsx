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
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-3 animate-rise">
        <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">Pacific</p>
        {error ? (
          <p className="font-mono text-sm text-status-red" role="alert">
            Link inválido ou expirado. Peça um novo ao seu credor.
          </p>
        ) : (
          <div className="flex items-center gap-2.5 justify-center">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-sonar" />
            </span>
            <p className="font-mono text-sm text-text-dim tracking-wider">Estabelecendo conexão segura…</p>
          </div>
        )}
      </div>
    </main>
  );
}
