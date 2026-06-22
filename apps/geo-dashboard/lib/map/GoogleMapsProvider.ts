import type { MapProvider } from './MapProvider.js';
// Stub p/ futura expansão (spec). Implementar quando/se trocar de provider.
export class GoogleMapsProvider implements Partial<MapProvider> {
  constructor() {
    throw new Error('GoogleMapsProvider ainda não implementado (stub). Use o MapLibreProvider.');
  }
}
