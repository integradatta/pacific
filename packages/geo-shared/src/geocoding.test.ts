import { describe, it, expect } from 'vitest';
import { geocodeCacheKey } from './geocoding.js';

describe('geocodeCacheKey', () => {
  it('arredonda a 4 casas decimais (~11m)', () => {
    expect(geocodeCacheKey(-23.55052, -46.63331)).toEqual({ latRounded: -23.5505, lngRounded: -46.6333 });
  });
  it('coordenadas próximas (< ~11m) caem na mesma chave', () => {
    const a = geocodeCacheKey(-23.550521, -46.633308);
    const b = geocodeCacheKey(-23.550519, -46.633312);
    expect(a).toEqual(b);
  });
});
