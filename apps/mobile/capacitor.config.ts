import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativo (família / metas). Estratégia: casca nativa que carrega o portal web Pacific
 * (server.url) — reaproveita 100% da UI já pronta (login por convite + metas + localização).
 * O compartilhamento de localização em segundo plano entra pelo plugin nativo de
 * background-geolocation (ver apps/web/lib/location-manager.ts + native-templates/).
 *
 * Ambientes (dev / staging / prod) selecionados por MOBILE_ENV. Cada um aponta para um web diferente.
 * Sobrescreva a URL com MOBILE_WEB_URL quando precisar (ex.: apontar o device para o seu laptop).
 */
type Env = 'dev' | 'staging' | 'prod';
const ENV = (process.env.MOBILE_ENV as Env) || 'prod';

const WEB_URL: Record<Env, string> = {
  // Dev: o Next rodando no seu laptop (troque pelo IP da sua máquina p/ testar em device físico).
  dev: process.env.MOBILE_WEB_URL || 'http://localhost:3000',
  // Staging: um deploy de homologação (Vercel preview / subdomínio).
  staging: process.env.MOBILE_WEB_URL || 'https://staging.pacific.app',
  // Prod: o web de produção.
  prod: process.env.MOBILE_WEB_URL || 'https://pacific-web-chi.vercel.app',
};

// appId por ambiente evita conflito ao instalar dev/staging/prod no mesmo aparelho.
const APP_ID: Record<Env, string> = {
  dev: 'app.pacific.mobile.dev',
  staging: 'app.pacific.mobile.staging',
  prod: 'app.pacific.mobile',
};
const APP_NAME: Record<Env, string> = {
  dev: 'Pacific (dev)',
  staging: 'Pacific (staging)',
  prod: 'Pacific',
};

const config: CapacitorConfig = {
  appId: APP_ID[ENV],
  appName: APP_NAME[ENV],
  webDir: 'www',
  server: {
    url: WEB_URL[ENV],
    androidScheme: 'https',
    // Dev em http (localhost) precisa de cleartext; staging/prod são https.
    cleartext: ENV === 'dev',
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    // O compartilhamento em segundo plano é configurado em runtime (apps/web/lib/location-manager.ts).
    // A notificação persistente do Android nunca é oculta — awareness do usuário é obrigatória.
  },
};

export default config;
