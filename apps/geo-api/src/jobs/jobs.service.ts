import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { retentionPlan, SUMMARY_RETENTION_DAYS, SUPABASE_FREE_BYTES, type RetentionPlan } from '@pacific/geo-shared';
import { GEO_DB, type GeoDb } from '../common/geo-db.js';

// Jobs de manutenção (spec §1.5/§1.6). Rodam GLOBAL (sem tenant) via adminQuery — requer
// conexão com role que ignora RLS. SQL PostGIS validado contra o Supabase.
@Injectable()
export class JobsService {
  private readonly log = new Logger('GeoJobs');
  constructor(@Inject(GEO_DB) private readonly db: GeoDb) {}

  async storageStatus(): Promise<{ usedBytes: number; limitBytes: number; plan: RetentionPlan }> {
    const r = await this.db.adminQuery<{ bytes: string }>(`SELECT pg_database_size(current_database())::bigint AS bytes`);
    const usedBytes = Number(r.rows[0]?.bytes ?? 0);
    return { usedBytes, limitBytes: SUPABASE_FREE_BYTES, plan: retentionPlan(usedBytes) };
  }

  /** Agregação + purge a cada 6h (mais frequente que 1x/dia p/ proteger o free tier). */
  @Cron('0 0 */6 * * *')
  async aggregateAndPurge(): Promise<void> {
    const { plan, usedBytes } = await this.storageStatus();

    // 1) Resumo diário dos dias COMPLETOS ainda não resumidos (Douglas-Peucker via ST_Simplify).
    await this.db.adminQuery(
      `INSERT INTO geo.daily_route_summary
         (user_id, tenant_id, group_id, date, total_distance_meters, total_points,
          simplified_route, start_location, end_location, start_time, end_time)
       SELECT lp.user_id, lp.tenant_id, lp.group_id, (lp.recorded_at AT TIME ZONE 'UTC')::date AS d,
              0, count(*),
              ST_Simplify(ST_MakeLine(lp.coordinates::geometry ORDER BY lp.recorded_at), 0.001)::geography,
              (array_agg(lp.coordinates ORDER BY lp.recorded_at))[1],
              (array_agg(lp.coordinates ORDER BY lp.recorded_at DESC))[1],
              min(lp.recorded_at), max(lp.recorded_at)
       FROM geo.location_point lp
       WHERE (lp.recorded_at AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date
       GROUP BY lp.user_id, lp.tenant_id, lp.group_id, d
       ON CONFLICT (tenant_id, user_id, group_id, date) DO NOTHING`,
    );

    // 2) Purge de dados brutos conforme a retenção (degradada por storage).
    const purgedRaw = await this.db.adminQuery(
      `DELETE FROM geo.location_point WHERE recorded_at < now() - ($1 || ' hours')::interval`,
      [String(plan.rawHours)],
    );
    // 3) Purge de resumos > 90d e cache expirado.
    await this.db.adminQuery(`DELETE FROM geo.daily_route_summary WHERE date < (now() AT TIME ZONE 'UTC')::date - $1`, [SUMMARY_RETENTION_DAYS]);
    await this.db.adminQuery(`DELETE FROM geo.geocoding_cache WHERE expires_at < now()`);

    this.log.log(`aggregateAndPurge: rawHours=${plan.rawHours} emergency=${plan.emergency} usedBytes=${usedBytes} purgedRaw=${purgedRaw.rowCount}`);
  }

  /** Lugares frequentes via ST_ClusterDBSCAN (eps 100m, min 5) — 1x/dia de madrugada. */
  @Cron('0 0 3 * * *')
  async clusterFrequentPlaces(): Promise<void> {
    // Clusteriza os pontos brutos recentes (até 48h) por usuário/grupo e materializa centróides.
    // eps em graus ≈ 100m (~0.0009). Heurística de label (casa/trabalho) é refinada à parte.
    await this.db.adminQuery(
      `WITH clustered AS (
         SELECT user_id, tenant_id, group_id,
                ST_ClusterDBSCAN(coordinates::geometry, 0.0009, 5) OVER (PARTITION BY user_id, group_id) AS cid,
                coordinates
         FROM geo.location_point
         WHERE recorded_at > now() - interval '48 hours'
       ), centroids AS (
         SELECT user_id, tenant_id, group_id, cid,
                ST_Centroid(ST_Collect(coordinates::geometry))::geography AS centroid,
                count(*) AS visits
         FROM clustered WHERE cid IS NOT NULL
         GROUP BY user_id, tenant_id, group_id, cid
       )
       INSERT INTO geo.frequent_place (user_id, tenant_id, group_id, centroid, radius_meters, visit_count, first_seen_at, last_seen_at, is_active)
       SELECT user_id, tenant_id, group_id, centroid, 100, visits, now(), now(), true FROM centroids`,
    );
    this.log.log('clusterFrequentPlaces: executado');
  }
}
