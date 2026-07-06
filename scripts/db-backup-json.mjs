// Backup de DADOS via Prisma (interino, quando não há pg_dump na máquina).
// Conecta com DIRECT_URL (role `postgres`, BYPASSRLS → lê todas as linhas de todos os tenants) e
// exporta TODAS as tabelas do schema public para um JSON timestamped em ./backups/ (gitignored).
//
// ⚠️ Contém PII — guarde em local privado. NÃO substitui o pg_dump (isto é só dados, sem DDL/sequences;
//    o schema vive nas migrations versionadas). Uso: node scripts/db-backup-json.mjs
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const env = fs.readFileSync('packages/database/.env', 'utf8');
const url = env.match(/^DIRECT_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// BigInt (int8) não é serializável por padrão; Date vira ISO automaticamente.
const replacer = (_k, v) => (typeof v === 'bigint' ? v.toString() : v);

try {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`,
  );
  const dump = { _meta: { at: new Date().toISOString(), source: 'db-backup-json', tables: {} }, data: {} };
  for (const { tablename } of tables) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tablename}"`);
    dump.data[tablename] = rows;
    dump._meta.tables[tablename] = rows.length;
  }
  fs.mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `backups/pacific-data-${stamp}.json`;
  fs.writeFileSync(file, JSON.stringify(dump, replacer, 2));
  const total = Object.values(dump._meta.tables).reduce((a, b) => a + b, 0);
  console.log(`✓ Backup de dados: ${file}`);
  console.log(`  ${Object.keys(dump.data).length} tabelas, ${total} linhas no total.`);
  const notable = Object.entries(dump._meta.tables).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  for (const [t, n] of notable.slice(0, 12)) console.log(`    ${t}: ${n}`);
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(2);
} finally {
  await prisma.$disconnect();
}
