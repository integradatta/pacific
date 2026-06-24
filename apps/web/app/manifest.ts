import type { MetadataRoute } from 'next';

// PWA do sobrinho (devedor): instalável na tela inicial. start_url no portal financeiro.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pacific',
    short_name: 'Pacific',
    description: 'Acompanhe sua ajuda: valor, vencimento e situação.',
    start_url: '/me',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070A11',
    theme_color: '#070A11',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
