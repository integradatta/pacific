# Decisões tomadas autonomamente (preparação para distribuição)

Como a execução foi offline, resolvi cada ambiguidade pela opção mais padrão/conservadora e registrei
aqui, com a alternativa descartada. Nada foi mergeado na main.

### Branch
**Escolhido:** `feat/mobile-distribution`, criada a partir de `feat/super-admin` (HEAD atual).
**Alternativa descartada:** criar a partir de `main`. Motivo: a integração de background geolocation
constrói sobre a versão mais recente de `apps/web/lib/location-manager.ts` (cadência 5 min +
Capacitor-aware), que está em `feat/super-admin`, não em `main`. Ao revisar, mergeie na ordem
combinada (o usuário já tem uma fila em feat/super-admin).

### Arquitetura do app: casca remota vs. bundle
**Escolhido:** manter a casca Capacitor carregando o portal web via `server.url` (arquitetura
existente). O `www/index.html` virou um splash real white-label + aviso de localização + fallback.
**Alternativa descartada:** empacotar um export estático do Next dentro de `www/`. Motivo: mudança
grande de build, fora do escopo. **Recomendação futura:** para robustez e para reduzir risco de
rejeição da Apple por "app é só um site", avaliar bundlar as telas do sobrinho. Registrado para depois.

### Nome / bundle id
**Escolhido:** appName "Pacific"; appId `app.pacific.mobile` (prod), `.dev` / `.staging` nos outros.
**Alternativa descartada:** renomear para um nome novo. Motivo: "Pacific" é neutro (não sugere dívida)
e já estava configurado; renomear exigiria novos assets/ids sem ganho claro.

### Plugin de background geolocation
**Escolhido:** `@capacitor-community/background-geolocation` (MIT, grátis). Foreground service +
notificação persistente no Android; location background no iOS.
**Alternativa descartada:** `@transistorsoft/capacitor-background-geolocation` (mais robusto, porém
**licença paga** por app em produção). Descartado por custo; se precisar de mais precisão/robustez no
futuro, é o upgrade natural.

### Cadência e bateria
**Escolhido:** throttle de ~1 ponto a cada **5 min**, baixa precisão (`enableHighAccuracy:false`),
`distanceFilter` 25 m no nativo. Coerente com "estabilidade > tempo real" e milhares de usuários.
**Alternativa descartada:** watch contínuo de alta precisão (mais drenagem de bateria, sem ganho real
para o caso de uso).

### Localização em segundo plano — awareness
**Escolhido:** notificação persistente e visível no Android ("Compartilhando sua localização com a
família") + aviso permanente na UI + fluxo "When in Use" antes de "Always". Nada oculto.
**Alternativa descartada:** qualquer coleta silenciosa — proibida pelo escopo e pelas lojas.

### Assinatura Android
**Escolhido:** `signingConfig` de release lendo `keystore.properties` (gitignored). Senha forte
aleatória já gerada (openssl). A keystore em si será criada com `keytool` no seu Mac (faltava Java no
ambiente de preparação) — comando pronto em QUANDO_EU_VOLTAR.md.
**Alternativa descartada:** senha fraca/fixa ou keystore versionada — inseguro.

### Segredos
**Escolhido:** `.gitignore` cobrindo keystore, `keystore.properties`, `QUANDO_EU_VOLTAR.md`,
`google-services.json`, `GoogleService-Info.plist`, provisioning/certs, e artefatos de build.
`keystore.properties.example` versionado (sem segredo) documenta a estrutura.

### O que NÃO deu para fechar no ambiente de preparação (sem toolchain)
- Sem **Java/JDK** → não gerei a keystore nem rodei `./gradlew assembleRelease`.
- Sem **Android SDK** → não rodei `cap add android` completo.
- Sem **Xcode/CocoaPods** → não rodei `cap add ios` nem o archive.
- **Feito e verificado:** `npm install` OK; `capacitor.config.ts` válido; `cap sync` (camada web)
  limpo. Tudo o mais está pronto para rodar no Mac (ver DEPLOY_MOBILE.md + QUANDO_EU_VOLTAR.md).
