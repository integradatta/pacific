import { describe, it, expect } from 'vitest';
import { LocationModule } from './location.module.js';
import { LOCATION_PROVIDER, LOCATION_SERVICE } from './location.tokens.js';
import type {
  LocationProvider, LocationService, LocationConsent, LivePosition, Geofence, LocationHistoryPage, LocationEvent,
} from '@pacific/shared';

class NoopProvider implements LocationProvider {
  readonly id = 'noop';
  async getLastPosition(): Promise<LivePosition | null> { return null; }
  subscribe(): () => void { return () => {}; }
}
class NoopService implements LocationService {
  async getConsent(debtorId: string): Promise<LocationConsent> {
    return { debtorId, state: 'NEVER', grantedAt: null, revokedAt: null, updatedAt: new Date().toISOString() };
  }
  async setConsent(debtorId: string): Promise<LocationConsent> {
    return { debtorId, state: 'GRANTED', grantedAt: new Date().toISOString(), revokedAt: null, updatedAt: new Date().toISOString() };
  }
  async getLastPosition(): Promise<LivePosition | null> { return null; }
  history = { async query(): Promise<LocationHistoryPage> { return { entries: [], nextCursor: null }; } };
  async listGeofences(): Promise<Geofence[]> { return []; }
  onLocationEvent(_h: (e: LocationEvent) => void): () => void { return () => {}; }
}

describe('LocationModule (seam de extensão)', () => {
  it('register devolve DynamicModule com tokens exportados', () => {
    const mod = LocationModule.register({
      provider: { provide: LOCATION_PROVIDER, useClass: NoopProvider },
      service: { provide: LOCATION_SERVICE, useClass: NoopService },
    });
    expect(mod.module).toBe(LocationModule);
    expect(mod.exports).toEqual([LOCATION_PROVIDER, LOCATION_SERVICE]);
    expect(mod.providers).toHaveLength(2);
  });
});
