'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, type GroupRow } from '@/lib/api';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<GroupRow[]>('/api/v1/groups')
      .then(setGroups)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: 2, color: '#7E899D', textTransform: 'uppercase' }}>
        Painel · Geolocalização em grupo
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>Meus grupos</h1>

      {error ? (
        <p style={{ color: '#F0556A', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          Não foi possível carregar os grupos. ({error}) — verifique o login e a API.
        </p>
      ) : groups === null ? (
        <p style={{ color: '#7E899D' }}>Carregando…</p>
      ) : groups.length === 0 ? (
        <p style={{ color: '#7E899D' }}>Nenhum grupo ainda.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
          {groups.map((g) => (
            <li key={g.id} style={{ border: '1px solid #1F2837', borderRadius: 12, padding: 16, marginBottom: 10, background: '#121826' }}>
              <Link href={`/groups/${g.id}`} style={{ fontSize: 16 }}>
                {g.name}
              </Link>
              <span style={{ marginLeft: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#7E899D', textTransform: 'uppercase' }}>
                {g.group_type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
