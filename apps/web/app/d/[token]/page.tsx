'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exchangeLink } from '@/lib/debtor';
import { DebtorLinkScreen } from '@/components/DebtorLinkScreen';

// Compatibilidade: links ANTIGOS no path (/d/<token>) continuam funcionando. Links NOVOS usam o
// fragment (/d#<token>, ver ../page.tsx) para não vazar o token em logs/unfurl.
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

  return <DebtorLinkScreen error={error} />;
}
