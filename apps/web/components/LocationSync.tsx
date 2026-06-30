'use client';

import { useEffect } from 'react';
import { useMyConsent, useSetMyConsent } from '@/lib/debtor-location';
import { debtorApiPost } from '@/lib/debtor';
import { locationManager } from '@/lib/location-manager';

/*
 * Liga o gerenciador de localização (singleton) ao estado de consentimento. Renderiza null.
 * Incluído em TODAS as telas do sobrinho (/me e /local) → o compartilhamento roda enquanto o app
 * estiver aberto, independente da aba; como o manager é singleton, trocar de aba não reinicia o GPS.
 */
export function LocationSync() {
  const consent = useMyConsent();
  const setConsent = useSetMyConsent();
  const state = consent.data?.state;

  useEffect(() => {
    if (!state) return; // espera o consentimento carregar antes de decidir
    locationManager.sync({
      active: state === 'GRANTED',
      send: (points) => debtorApiPost('/debtor/me/location/ping', { points }),
      onPermissionDenied: () => setConsent.mutate({ state: 'REVOKED' }),
    });
  }, [state, setConsent]);

  return null;
}
