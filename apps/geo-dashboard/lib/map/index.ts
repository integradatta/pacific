import type { MapProvider, MapProviderKind } from './MapProvider.js';
export type { MapProvider, MapMarker, MapProviderKind } from './MapProvider.js';

/** Fábrica: MapLibre é o padrão (gratuito, sem API key). Google/Mapbox são stubs. */
export async function createMapProvider(kind: MapProviderKind = 'maplibre'): Promise<MapProvider> {
  if (kind === 'maplibre') {
    const { MapLibreProvider } = await import('./MapLibreProvider.js');
    return new MapLibreProvider();
  }
  throw new Error(`MapProvider "${kind}" não implementado (stub).`);
}
