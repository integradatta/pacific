# native-templates/ — configs nativas para aplicar APÓS `cap add`

Os projetos nativos (`ios/`, `android/`) são **gerados** por `cap add` e ficam no `.gitignore`
(regeneráveis). Estes snippets são a fonte da verdade do que precisa ser aplicado neles. Depois de
`npm run add:ios` / `npm run add:android`, aplique:

| Arquivo aqui | Onde aplicar | O quê |
|---|---|---|
| `Info.plist.snippet.xml` | `ios/App/App/Info.plist` | Purpose strings de localização + UIBackgroundModes |
| `AndroidManifest.snippet.xml` | `android/app/src/main/AndroidManifest.xml` | Permissões de localização |
| `app-build.gradle.signing.snippet` | `android/app/build.gradle` | signingConfig de release lendo `keystore.properties` |

O plugin `@capacitor-community/background-geolocation` já adiciona seu **foreground service** e a
notificação persistente via merge de manifesto — você só declara as permissões abaixo.

Detalhes passo a passo em `../DEPLOY_MOBILE.md`.
