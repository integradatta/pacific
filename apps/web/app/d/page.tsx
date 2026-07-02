'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exchangeLink } from '@/lib/debtor';
import { DebtorLinkScreen } from '@/components/DebtorLinkScreen';

// Entrada por link mágico com o token no FRAGMENT (/d#<token>). O fragment nunca é enviado ao
// servidor → não vaza em logs da Vercel nem no unfurl do WhatsApp (o bot só busca o path).
// Limpamos o hash do histórico assim que lemos, para não sobrar no back/forward.
export default function DebtorLinkFragmentPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const token = window.location.hash.replace(/^#/, '');
    if (!token) {
      setError(true);
      return;
    }
    window.history.replaceState(null, '', '/d');
    exchangeLink(token)
      .then(() => active && router.replace('/me'))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [router]);

  return <DebtorLinkScreen error={error} />;
}
