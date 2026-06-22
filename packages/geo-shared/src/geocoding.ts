// Chave de cache de geocoding: coordenadas arredondadas a 4 casas (~11m) — spec §"Nominatim".
export interface GeocodeCacheKey {
  latRounded: number;
  lngRounded: number;
}

export function geocodeCacheKey(lat: number, lng: number): GeocodeCacheKey {
  return {
    latRounded: Math.round(lat * 1e4) / 1e4,
    lngRounded: Math.round(lng * 1e4) / 1e4,
  };
}

export const NOMINATIM_USER_AGENT = 'GeoGroupModule/1.0 (projeto-academico)';
export const NOMINATIM_MIN_INTERVAL_MS = 1000; // 1 req/s
export const GEOCODE_CACHE_TTL_DAYS = 30;
