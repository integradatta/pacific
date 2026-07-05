import type { MetadataRoute } from 'next';

// PWA instalável na tela inicial (sobrinho, padrinho ou admin). O start_url é a raiz "/",
// que roteia por QUEM está logado (ver app/page.tsx) — não uma rota fixa. Assim o atalho abre
// a interface certa de cada pessoa, em vez de mandar todo mundo pro app do sobrinho.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pacific',
    short_name: 'Pacific',
    description: 'Acompanhe suas metas e sua família.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070A11',
    theme_color: '#070A11',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
