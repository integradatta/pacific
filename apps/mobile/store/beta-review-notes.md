# Beta App Review — notas (copiar/colar no App Store Connect → TestFlight → Test Information)

> Cole o texto abaixo no campo "Review Notes" / "Notas para o revisor". Ele explica o uso de
> localização em segundo plano, que é o ponto que a Apple mais escrutina. Ajuste nomes se quiser.

---

**Sobre o app**
Pacific é um app de metas de economia e localização em família. As pessoas de uma família se
conectam para acompanhar uma meta em comum e, opcionalmente, compartilhar a localização entre si
— no espírito de apps como Find My / Life360 / Family Link.

**Login para o revisor**
O acesso é por convite (link mágico enviado à pessoa). Para revisão, use este convite de teste:
[ COLE AQUI UM LINK DE CONVITE DE TESTE VÁLIDO — gere um no painel e cole antes de enviar ]

**Uso de localização (When in Use e Always)**
- O compartilhamento de localização é **100% opcional** e **desligável a qualquer momento** na aba
  "Localização".
- Primeiro pedimos permissão **"Ao usar o app" (When in Use)**, com explicação na própria tela do
  app antes do prompt do sistema.
- Só depois, e apenas se a pessoa optar por continuar, pedimos **"Sempre" (Always)**, também com
  contexto claro na UI.
- Em segundo plano, a localização é atualizada **a cada poucos minutos** (não em tempo real), para
  economizar bateria. No Android há uma **notificação persistente e visível** informando que o
  compartilhamento está ativo. Nada é coletado de forma oculta.
- O propósito é aproximar membros da família que consentiram — nunca vigilância sem ciência.

**Como testar a localização**
1. Abra o app e faça login pelo convite acima.
2. Vá em "Localização" → "Começar a compartilhar" → conceda "Ao usar o app".
3. (Opcional) Aceite "Sempre" quando solicitado, com o app explicando o motivo.
4. Minimize o app: a localização segue sendo atualizada a cada poucos minutos (iOS) / com
   notificação persistente (Android).
5. Para parar: "Localização" → "Parar de compartilhar".

**Privacidade**
Dados de localização são usados apenas para o compartilhamento consentido dentro da família e podem
ser interrompidos e removidos pela própria pessoa a qualquer momento.
