import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativo do sobrinho. Estratégia: o app é uma casca nativa que carrega o portal web Pacific
 * (server.url) — reaproveita 100% da UI já pronta. Push e GPS-background entram via plugins nativos.
 *
 * Troque `server.url` pelo domínio de produção (ou um subdomínio dedicado do sobrinho) antes de publicar.
 */
const config: CapacitorConfig = {
  appId: 'app.pacific.mobile',
  appName: 'Pacific',
  webDir: 'www',
  server: {
    url: process.env.MOBILE_WEB_URL ?? 'https://pacific-web-chi.vercel.app',
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
