import pg from 'pg';

/** Executor de queries (subset do pg.PoolClient) — facilita mock nos testes. */
export interface Querier {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}

/** Acesso ao banco com escopo de tenant (RLS via app.current_tenant por transação). */
export interface GeoDb {
  withTenant<T>(tenantId: string, fn: (q: Querier) => Promise<T>): Promise<T>;
  /**
   * Query global SEM escopo de tenant — só para JOBS de manutenção (purge/agregação/DBSCAN).
   * Requer conexão com role que ignora RLS (BYPASSRLS / service role do Supabase). NUNCA usar
   * em caminho de request de usuário.
   */
  adminQuery<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}

export const GEO_DB = Symbol('GEO_DB');

/** Implementação real (pg Pool). Cada withTenant abre transação e seta app.current_tenant. */
export class GeoDbPg implements GeoDb {
  private readonly pool: pg.Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = new pg.Pool({ connectionString });
  }

  async withTenant<T>(tenantId: string, fn: (q: Querier) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async adminQuery<R = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: R[]; rowCount: number | null }> {
    const r = await this.pool.query(text, params);
    return { rows: r.rows as R[], rowCount: r.rowCount };
  }
}
