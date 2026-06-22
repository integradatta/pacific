import type { LatLng } from '@pacific/geo-shared';

// Camada de abstração de mapas (spec). Toda interação com MapLibre passa por aqui, permitindo
// trocar por Google/Mapbox sem mexer na lógica de negócio.
export interface MapMarker {
  setPosition(p: LatLng): void;
  remove(): void;
}

export interface MapProvider {
  mount(container: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<void>;
  addMarker(p: LatLng, opts?: { color?: string; title?: string }): MapMarker;
  /** Círculo em METROS (geofence). `id` permite atualizar/remover. */
  setCircle(id: string, center: LatLng, radiusMeters: number, opts?: { color?: string }): void;
  setPolyline(id: string, points: LatLng[], opts?: { color?: string }): void;
  fitBounds(points: LatLng[], paddingPx?: number): void;
  reverseGeocode(p: LatLng): Promise<string | null>;
  destroy(): void;
}

export type MapProviderKind = 'maplibre' | 'google' | 'mapbox';
