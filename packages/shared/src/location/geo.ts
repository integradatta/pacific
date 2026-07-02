export interface LatLng { lat: number; lng: number }

/** Distância em metros entre dois pontos (haversine). Fonte única para API e web. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // raio médio da Terra (m)
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
