import { describe, it, expect } from 'vitest';
import { retentionPlan, SUPABASE_FREE_BYTES } from './retention.js';

describe('retentionPlan', () => {
  const L = SUPABASE_FREE_BYTES;
  it('uso normal → 48h, sem emergência', () => {
    expect(retentionPlan(0.5 * L, L)).toMatchObject({ rawHours: 48, emergency: false });
  });
  it('> 80% → degrada para 24h', () => {
    expect(retentionPlan(0.85 * L, L)).toMatchObject({ rawHours: 24, emergency: false });
  });
  it('> 90% → 12h + purge emergencial', () => {
    expect(retentionPlan(0.95 * L, L)).toMatchObject({ rawHours: 12, emergency: true });
  });
});
