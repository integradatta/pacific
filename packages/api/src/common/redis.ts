import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Conexão Redis compartilhada (A1) — só quando REDIS_URL está definido. Sem ela, retorna null e a
 * app cai no comportamento in-memory (1 réplica). Com Redis, o rate limit fica correto entre réplicas.
 * Erros de Redis são logados (Logger estruturado) mas NÃO derrubam a aplicação.
 */
const log = new Logger('Redis');
let client: Redis | null = null;
let resolved = false;

export function getRedis(): Redis | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { maxRetriesPerRequest: 3, enableReadyCheck: true });
  client.on('error', (e) => {
    log.warn(JSON.stringify({ action: 'redis.connection_error', message: String(e?.message ?? e) }));
  });
  return client;
}
