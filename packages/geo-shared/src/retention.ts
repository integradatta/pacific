// Política de retenção de dados brutos com degradação por uso de storage (spec §1.5).
// Free tier do Supabase = 500 MB. Padrão 48h; >80% → 24h; >90% → purge emergencial 12h.
export const SUPABASE_FREE_BYTES = 500 * 1024 * 1024;
export const RAW_DEFAULT_HOURS = 48;
export const RAW_DEGRADED_HOURS = 24;
export const RAW_EMERGENCY_HOURS = 12;
export const SUMMARY_RETENTION_DAYS = 90;

export interface RetentionPlan {
  rawHours: number;
  emergency: boolean;
  usedPct: number;
}

export function retentionPlan(usedBytes: number, limitBytes: number = SUPABASE_FREE_BYTES): RetentionPlan {
  const usedPct = limitBytes > 0 ? usedBytes / limitBytes : 0;
  if (usedPct > 0.9) return { rawHours: RAW_EMERGENCY_HOURS, emergency: true, usedPct };
  if (usedPct > 0.8) return { rawHours: RAW_DEGRADED_HOURS, emergency: false, usedPct };
  return { rawHours: RAW_DEFAULT_HOURS, emergency: false, usedPct };
}
