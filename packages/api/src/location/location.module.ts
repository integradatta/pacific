import { DynamicModule, Module, Provider } from '@nestjs/common';
import { LOCATION_PROVIDER, LOCATION_SERVICE } from './location.tokens.js';

export interface LocationModuleOptions { provider: Provider; service: Provider; }

/**
 * Seam de extensão. NÃO registrado no AppModule agora. Um futuro Módulo de
 * Localização implementa LocationProvider/LocationService (de @pacific/shared)
 * e pluga via LocationModule.register({...}) sem alterar o core.
 */
@Module({})
export class LocationModule {
  static register(options: LocationModuleOptions): DynamicModule {
    return {
      module: LocationModule,
      providers: [options.provider, options.service],
      exports: [LOCATION_PROVIDER, LOCATION_SERVICE],
    };
  }
}
