# Distribuição do app — Android (APK) + iOS (TestFlight)

Casca nativa (Capacitor) que carrega o portal web Pacific (`server.url` em `capacitor.config.ts`) e
adiciona **localização em segundo plano** via `@capacitor-community/background-geolocation` (foreground
service + notificação persistente e visível — nada oculto).

> **Estado desta branch (`feat/mobile-distribution`):** já feito por código —
> `capacitor.config.ts` (dev/staging/prod), `www/index.html` real (white-label + aviso de
> localização), plugin de background geolocation integrado em `apps/web/lib/location-manager.ts`,
> deps instaladas (`npm i` OK), `cap sync` (camada web) limpo, templates nativos e review notes.
> **Falta rodar no seu Mac** (precisa de Android SDK / Xcode / Java, ausentes no ambiente de
> preparação): gerar keystore, `cap add ios/android`, aplicar os snippets nativos, build/archive.
> O resumo curto do que depende de você está em **QUANDO_EU_VOLTAR.md** (local, gitignored).

---

## Pré-requisitos (uma vez)
- **Android:** Android Studio (inclui SDK) + JDK 17. `keytool` (vem do JDK).
- **iOS:** Mac com **Xcode** + **CocoaPods** (`sudo gem install cocoapods`). Conta **Apple Developer** (US$ 99/ano).
- Node/npm já instalados.

```bash
cd apps/mobile
npm install            # deps do Capacitor + plugins (já rodado nesta branch)
```

---

## Ambientes
`capacitor.config.ts` escolhe o web por `MOBILE_ENV` (dev | staging | prod, default prod) e permite
sobrescrever a URL com `MOBILE_WEB_URL`. appId por ambiente (dev/staging/prod) para conviverem no
mesmo aparelho.

```bash
npm run sync:dev       # MOBILE_ENV=dev  → http://localhost:3000 (troque pelo IP p/ device físico)
npm run sync:staging   # MOBILE_ENV=staging
npm run sync:prod      # MOBILE_ENV=prod → web de produção
```

---

## ANDROID — gerar o APK assinado

### 1. Adicionar a plataforma
```bash
npm run add:android          # gera apps/mobile/android/ (gitignored)
```

### 2. Aplicar os configs nativos (ver `native-templates/`)
- `AndroidManifest.snippet.xml` → `android/app/src/main/AndroidManifest.xml` (permissões de localização).
- `app-build.gradle.signing.snippet` → `android/app/build.gradle` (signingConfig lendo `keystore.properties`).

### 3. Keystore de release (uma vez — NÃO versionar)
Já existe um `keystore.properties` (gitignored) com uma **senha forte gerada**. Falta criar a keystore.
O comando exato (com a senha certa) está em **QUANDO_EU_VOLTAR.md**. Em resumo:
```bash
cd apps/mobile
keytool -genkeypair -v -keystore pacific-upload.keystore \
  -alias pacific-upload -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "<SENHA_DO_keystore.properties>" -keypass "<MESMA_SENHA>" \
  -dname "CN=Pacific, OU=Mobile, O=Pacific, L=, S=, C=BR"
```
Guarde a keystore + senha com segurança: **perdê-las impede publicar updates** do mesmo app.

### 4. Build
```bash
npm run build:android
# = MOBILE_ENV=prod cap sync android && cd android && ./gradlew assembleRelease
# APK: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 5. Distribuir
- **Link direto:** suba o `.apk` em qualquer host (o usuário precisa permitir "fontes desconhecidas").
- **Firebase App Distribution (recomendado):** crie o projeto no Firebase, e
  `firebase appdistribution:distribute app-release.apk --app <APP_ID> --groups testers`.

### Versionamento (updates)
Em `android/app/build.gradle` → `defaultConfig`:
- `versionCode` (inteiro): **incrementa a cada upload** (1, 2, 3…). Play/Firebase exigem ser maior que o anterior.
- `versionName` (string): versão legível ("1.0.0", "1.0.1"…).

---

## iOS — TestFlight

### 1. Adicionar a plataforma
```bash
npm run add:ios              # gera apps/mobile/ios/ (gitignored); roda pod install
```

### 2. Aplicar os configs nativos
- `native-templates/Info.plist.snippet.xml` → `ios/App/App/Info.plist` (purpose strings + UIBackgroundModes).

### 3. Abrir no Xcode e configurar assinatura
```bash
npm run open:ios
```
No Xcode → target **App** → **Signing & Capabilities**:
- Marque **Automatically manage signing** e selecione seu **Team** (login Apple ID + 2FA).
- Bundle Identifier: `app.pacific.mobile` (prod).
- Adicione a capability **Background Modes → Location updates**.

### 4. Archive + upload
- Selecione **Any iOS Device (arm64)** → **Product → Archive**.
- No Organizer → **Distribute App → App Store Connect → Upload**.
- Em App Store Connect → TestFlight: preencha as **Review Notes** (use `store/beta-review-notes.md`)
  e adicione testadores. O Beta App Review costuma levar ~1 dia.

> Certificate + provisioning profile + upload **exigem seu Apple ID + 2FA** — não dá para automatizar
> sem você. Ver QUANDO_EU_VOLTAR.md.

---

## Ícones / splash
```bash
# um PNG 1024×1024 em apps/mobile/assets/icon.png (derive do app), então:
npm run assets
```

## Deep links (abrir o convite `/d#<token>` no app) — opcional
Configure Universal Links (iOS) / App Links (Android) apontando para o domínio do web. Ver docs do
Capacitor. Sem isso, o convite abre no navegador (funciona), não no app.

## Teste de background (documentar resultado)
Com localização ativa: minimize o app e bloqueie a tela.
- **Android:** deve aparecer a notificação persistente "Compartilhando sua localização com a família";
  os pings continuam (a cada ~5 min). Confira no painel do responsável que a posição atualiza.
- **iOS:** com "Always" concedido e Background Modes → Location, o iOS entrega updates em segundo
  plano (cadência controlada pelo sistema; nosso throttle é ~5 min).
