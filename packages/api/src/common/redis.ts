import { Redis } from 'ioredis';

/**
 * Conexão Redis compartilhada (A1) — só quando REDIS_URL está definido. Sem ela, retorna null e a
 * app cai no comportamento in-memory (1 réplica). Com Redis, o rate limit fica correto entre réplicas.
 * Erros de Redis são logados mas NÃO derrubam a aplicação.
 */
let client: Redis | null = null;
let resolved = false;

export function getRedis(): Redis | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { maxRetriesPerRequest: 3, enableReadyCheck: true });
  client.on('error', (e) => {
    // eslint-disable-next-line no-console
    console.error(`[redis] erro de conexão: ${String(e?.message ?? e)}`);
  });
  return client;
}
