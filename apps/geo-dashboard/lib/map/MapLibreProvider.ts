import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import type { LatLng } from '@pacific/geo-shared';
import { NOMINATIM_USER_AGENT } from '@pacific/geo-shared';
import type { MapMarker, MapProvider } from './MapProvider.js';

// Estilo raster do OpenStreetMap — gratuito, sem API key. (Uso acadêmico/baixo volume.)
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

/** Polígono que aproxima um círculo de `radiusMeters` ao redor de `center` (64 lados). */
function circlePolygon(center: LatLng, radiusMeters: number, steps = 64): GeoJSON.Feature {
  const coords: [number, number][] = [];
  const earth = 6_378_137;
  const dLat = (radiusMeters / earth) * (180 / Math.PI);
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

export class MapLibreProvider implements MapProvider {
  private map: MlMap | null = null;
  private ml: typeof import('maplibre-gl') | null = null;
  private markers: MlMarker[] = [];

  async mount(container: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<void> {
    this.ml = await import('maplibre-gl');
    this.map = new this.ml.Map({
      container,
      style: OSM_STYLE,
      center: [opts.center.lng, opts.center.lat],
      zoom: opts.zoom,
    });
    await new Promise<void>((resolve) => this.map!.on('load', () => resolve()));
  }

  addMarker(p: LatLng, opts?: { color?: string; title?: string }): MapMarker {
    const map = this.requireMap();
    if (!this.ml) throw new Error('Mapa não montado');
    const marker = new this.ml.Marker({ color: opts?.color ?? '#2BE5C2' }).setLngLat([p.lng, p.lat]).addTo(map);
    this.markers.push(marker);
    return {
      setPosition: (np: LatLng) => marker.setLngLat([np.lng, np.lat]),
      remove: () => marker.remove(),
    };
  }

  setCircle(id: string, center: LatLng, radiusMeters: number, opts?: { color?: string }): void {
    const map = this.requireMap();
    const data = circlePolygon(center, radiusMeters);
    const src = map.getSource(id) as { setData?: (d: GeoJSON.Feature) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    map.addSource(id, { type: 'geojson', data });
    map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': opts?.color ?? '#2BE5C2', 'fill-opacity': 0.12 } });
    map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': opts?.color ?? '#2BE5C2', 'line-width': 1.5 } });
  }

  setPolyline(id: string, points: LatLng[], opts?: { color?: string }): void {
    const map = this.requireMap();
    const data: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
      properties: {},
    };
    const src = map.getSource(id) as { setData?: (d: GeoJSON.Feature) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    map.addSource(id, { type: 'geojson', data });
    map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': opts?.color ?? '#7E899D', 'line-width': 3 } });
  }

  fitBounds(points: LatLng[], paddingPx = 48): void {
    if (points.length === 0) return;
    const map = this.requireMap();
    let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of points) {
      minLng = Math.min(minLng, p.lng);
      minLat = Math.min(minLat, p.lat);
      maxLng = Math.max(maxLng, p.lng);
      maxLat = Math.max(maxLat, p.lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: paddingPx, maxZoom: 16 });
  }

  async reverseGeocode(p: LatLng): Promise<string | null> {
    // Em produção, rotear pelo geo-api (throttle + cache). Aqui, chamada direta p/ demo.
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`;
      const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string };
      return data.display_name ?? null;
    } catch {
      return null;
    }
  }

  destroy(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    this.map?.remove();
    this.map = null;
  }

  private requireMap(): MlMap {
    if (!this.map) throw new Error('Mapa não montado');
    return this.map;
  }
}
