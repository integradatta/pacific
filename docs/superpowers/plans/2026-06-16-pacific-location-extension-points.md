# Pacific — Pontos de extensão de Localização (contratos, SEM implementação)

> Objetivo: deixar a arquitetura preparada para um futuro Módulo de Localização (opcional) sem refatoração. **Nenhuma funcionalidade é implementada** — apenas interfaces, contratos e estrutura de plug-in.

**Cobre as capacidades futuras:** localização compartilhada, geofencing, histórico de localização, eventos de chegada/saída, rastreamento em tempo real.

## Arquivos

```
packages/shared/src/location/contracts.ts   → interfaces/tipos (ports), re-export no index
packages/api/src/location/location.tokens.ts → tokens de DI (LOCATION_PROVIDER, LOCATION_SERVICE)
packages/api/src/location/location.module.ts → DynamicModule LocationModule.register(...) (shell)
packages/api/src/location/location.module.test.ts → verifica o shape do seam + contratos implementáveis
packages/api/src/location/README.md          → como plugar um módulo futuro
```

## Contratos (`@pacific/shared/src/location/contracts.ts`) — somente tipos

`GeoPoint`, `LivePosition`, `Geofence`, `LocationEventType` (`ARRIVAL`|`DEPARTURE`), `LocationEvent`, `ConsentState` (`NEVER`|`GRANTED`|`REVOKED`), `LocationConsent` (registro de consentimento), `LocationHistory` (port de consulta de histórico, paginado por cursor), `LocationProvider` (port: última posição, histórico, `subscribe` em tempo real → unsubscribe), `LocationService` (facade: consent + posição + histórico + geofences + `onLocationEvent`).

## Seam NestJS (sem registrar no AppModule)

- `location.tokens.ts`: `LOCATION_PROVIDER`, `LOCATION_SERVICE` (Symbols).
- `location.module.ts`: `@Module({})` com `static register({ provider, service }: { provider: Provider; service: Provider }): DynamicModule` que expõe os tokens. Não há provider concreto agora; um módulo futuro chama `LocationModule.register(...)` e adiciona ao `AppModule` sem mudar o core.

## Verificação

- Teste define uma classe no-op `implements LocationProvider`/`LocationService` (prova que os contratos são implementáveis em tempo de compilação) e checa que `LocationModule.register({...})` devolve `{ module: LocationModule, ... }` com os tokens exportados.
- `tsc --noEmit` e `vitest` passam. Nenhuma rota/feature é exposta.
