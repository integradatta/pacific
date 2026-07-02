# Pacific — App nativo do sobrinho (Capacitor)

Casca nativa (iOS/Android) que carrega o portal web Pacific (`server.url` em `capacitor.config.ts`).
Reaproveita 100% da UI já pronta. Push e GPS-background entram via plugins nativos.

## Pré-requisitos (ambiente — passo manual)
- **Android:** Android Studio (grátis, qualquer SO).
- **iOS:** um **Mac** com Xcode + CocoaPods (build/assinatura de iOS só roda em macOS).
- **Push:** projeto no **Firebase** (FCM, grátis) — Android e iOS.

## Gerar e rodar
```bash
cd apps/mobile
npm install                       # instala as deps do Capacitor
# aponte para o web em produção (ou deixe o default do capacitor.config.ts):
export MOBILE_WEB_URL="https://SEU-DOMINIO"
npm run add:android               # gera apps/mobile/android
npm run add:ios                   # gera apps/mobile/ios  (só no Mac)
npm run sync                      # copia config + plugins
npm run open:android             # abre no Android Studio  → Run
npm run open:ios                 # abre no Xcode           → Run  (só no Mac)
```

## Ícones e splash
Use `@capacitor/assets` com um PNG 1024×1024 (derive de `apps/web/public/icon.svg`):
```bash
npx @capacitor/assets generate --iconBackgroundColor '#070A11'
```

## Permissões de localização (OBRIGATÓRIO p/ App Store)

A Apple exige textos de propósito (purpose strings) claros para localização, senão **rejeita**. Use
linguagem white-label (família). Gerado o projeto iOS (`cap add ios`), edite
`apps/mobile/ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Compartilhe sua localização com a família enquanto o app está aberto. É voluntário e você pode desligar quando quiser.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Para manter a família por perto mesmo com o app em segundo plano, a localização é atualizada a cada poucos minutos. Você controla e pode parar a qualquer momento.</string>
<!-- Só inclua o modo background se realmente usar um plugin de background-geolocation: -->
<key>UIBackgroundModes</key>
<array><string>location</string></array>
```

Android (`android/app/src/main/AndroidManifest.xml`): `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION`
(+ `ACCESS_BACKGROUND_LOCATION` só se usar foreground service).

O gerenciador (`apps/web/lib/location-manager.ts`) amostra a cada **5 min** com baixa precisão
(bateria) e usa `@capacitor/geolocation` no nativo. **Background com o app FECHADO** exige um plugin
dedicado (ex.: `@capacitor-community/background-geolocation`) + os modos acima; sem ele, o
compartilhamento roda em foreground (app aberto).

## Push (FCM) e GPS-background (resumo)
- Push: criar app no Firebase, baixar `google-services.json` (Android) / `GoogleService-Info.plist` (iOS),
  registrar o device token e enviar ao backend. APNs (Apple) habilitado no Apple Developer.
- GPS-background: pedir permissão "Sempre" no primeiro uso (já no fluxo aprovado), usar `@capacitor/geolocation`
  + um plugin de background; enviar posições ao `geo-api` (módulo de GPS, branch `feat/geo-module`).
- **Deep links** (abrir o link mágico `/d/[token]` no app): configurar Universal Links (iOS) / App Links (Android).

## Publicar nas lojas
- **Google Play:** gerar AAB assinado (Android Studio) → Play Console → enviar.
- **App Store:** Archive no Xcode → App Store Connect → enviar para revisão.

## 💵 Custos (mínimos)
| Item | Custo | Observação |
|---|---|---|
| **Apple Developer Program** | **US$ 99 / ano** | Obrigatório p/ publicar na App Store |
| **Google Play Developer** | **US$ 25 (uma vez)** | Taxa única, vitalícia |
| Firebase (FCM, push) | **grátis** | Tier gratuito cobre o uso |
| Mac p/ build iOS | — | Necessário se for publicar iOS; ou usar build em nuvem (ex.: EAS/Appflow, tem tier grátis limitado) |
| Hosting web | já existe | Vercel (web) + Railway (API) |

**Primeiro ano (já tendo um Mac):** ~**US$ 124** (≈ R$ 650) → US$ 99 Apple + US$ 25 Google.
Sem Mac: some o custo de um Mac **ou** de um serviço de build iOS em nuvem.
Android sozinho: só os **US$ 25** (uma vez).
