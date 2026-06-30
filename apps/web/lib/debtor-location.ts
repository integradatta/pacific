'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { debtorApiGet, debtorApiPost } from './debtor';

export type ConsentState = 'NEVER' | 'DECLINED' | 'GRANTED' | 'REVOKED';

export function useMyConsent() {
  return useQuery({ queryKey: ['my-consent'], queryFn: () => debtorApiGet<{ state: ConsentState; updatedAt: string | null }>('/debtor/me/location/consent') });
}

export function useSetMyConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { state: 'GRANTED' | 'DECLINED' | 'REVOKED'; consentText?: string }) =>
      debtorApiPost<{ state: ConsentState }>('/debtor/me/location/consent', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-consent'] }),
  });
}

// A captura/envio de pings vive em lib/location-manager.ts (singleton) e é ligada via
// components/LocationSync.tsx — assim o compartilhamento persiste entre abas e telas.
