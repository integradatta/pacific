/**
 * Validação e2e do fluxo de link mágico do devedor contra Postgres REAL (embedded-postgres),
 * conectado como role NÃO-superuser (sujeito à RLS). Replica os serviços:
 * provisionamento (Debtor+DebtorAccess), exchange (lookup por tokenHash + login event),
 * self-view (própria dívida). Prova: resolução correta, hash no banco, token desconhecido,
 * revogação, rotação, isolamento por tenant+devedor, e auditoria isolada por RLS.
 */
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import pkg from 'pg';
import { PrismaClient } from '@prisma/client';

const { Client } = pkg;
const PORT = 5434;
const SUPER_URL = `postgresql://postgres:postgres@localhost:${PORT}/pacific`;
const APP_URL = `postgresql://pacific_app:apppass@localhost:${PORT}/pacific`;

const checks: { name: string; pass: boolean; detail: string }[] = [];
const record = (name: string, pass: boolean, detail: string): void => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} · ${name} — ${detail}`);
};

const genToken = (): string => randomBytes(32).toString('base64url');
const hash = (t: string): string => createHash('sha256').update(t).digest('hex');

async function withTenant<T>(prisma: PrismaClient, tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function provision(app: PrismaClient, tenantId: string, name: string): Promise<{ debtorId: string; token: string }> {
  const token = genToken();
  const debtorId = await withTenant(app, tenantId, async (tx) => {
    const d = await tx.debtor.create({ data: { tenantId, name } });
    await tx.debt.create({
      data: { tenantId, debtorId: d.id, principal: '1000.00', rate: '0', ratePeriod: 'MONTHLY', startDate: new Date('2026-01-01T00:00:00Z'), dueDate: new Date('2026-06-01T00:00:00Z') },
    });
    await tx.debtorAccess.create({ data: { debtorId: d.id, tenantId, tokenHash: hash(token) } });
    return d.id;
  });
  return { debtorId, token };
}

// Replica DebtorExchangeService: lookup pré-auth (DebtorAccess fora da RLS) + login event.
async function exchange(app: PrismaClient, rawToken: string): Promise<{ debtorId: string; tenantId: string } | null> {
  const access = await app.debtorAccess.findUnique({ where: { tokenHash: hash(rawToken) } });
  if (!access || !access.active) return null;
  await withTenant(app, access.tenantId, async (tx) => {
    await tx.debtorAccess.updateMany({ where: { debtorId: access.debtorId, tenantId: access.tenantId }, data: { lastSeenAt: new Date() } });
    await tx.debtorLoginEvent.create({ data: { debtorId: access.debtorId, tenantId: access.tenantId, success: true } });
  });
  return { debtorId: access.debtorId, tenantId: access.tenantId };
}

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({ databaseDir: '/tmp/pacific-pg-mle', user: 'postgres', password: 'postgres', port: PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('pacific');

  const admin = new Client({ connectionString: SUPER_URL });
  await admin.connect();
  await admin.query(readFileSync('packages/database/migrations/0_init/migration.sql', 'utf8'));
  await admin.query(`
    CREATE ROLE pacific_app LOGIN PASSWORD 'apppass' NOSUPERUSER;
    GRANT USAGE ON SCHEMA public TO pacific_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pacific_app;
  `);
  await admin.query(readFileSync('packages/database/src/rls.sql', 'utf8'));
  await admin.end();

  const app = new PrismaClient({ datasources: { db: { url: APP_URL } } });

  // Tenants (Tenant fora da RLS) + provisionamento de devedores.
  const tA = await app.tenant.create({ data: { name: 'Carteira A', orgCode: 'PAC-AAAA-MLE1' } });
  const tB = await app.tenant.create({ data: { name: 'Carteira B', orgCode: 'PAC-BBBB-MLE2' } });
  const ana = await provision(app, tA.id, 'Ana');   // tenant A
  const bob = await provision(app, tB.id, 'Bob');   // tenant B
  console.log(`Provisionados: Ana(${ana.debtorId})@A, Bob(${bob.debtorId})@B`);

  // 1) exchange de link válido resolve o devedor certo
  const okAna = await exchange(app, ana.token);
  record('exchange de link válido resolve o devedor certo', okAna?.debtorId === ana.debtorId && okAna?.tenantId === tA.id,
    `resolveu debtorId=${okAna?.debtorId === ana.debtorId ? 'Ana' : okAna?.debtorId} tenant=${okAna?.tenantId === tA.id ? 'A' : okAna?.tenantId}`);

  // 2) token guardado com hash (claro não fica no banco)
  const stored = await app.debtorAccess.findUnique({ where: { debtorId: ana.debtorId } });
  record('token guardado com hash (claro não persiste)', stored?.tokenHash === hash(ana.token) && stored?.tokenHash !== ana.token,
    `tokenHash == sha256(token) e != token em claro`);

  // 3) token desconhecido não resolve
  const unknown = await exchange(app, genToken());
  record('token desconhecido não resolve', unknown === null, `exchange(token aleatório) = ${unknown === null ? 'null' : 'RESOLVEU'}`);

  // 4) acesso revogado é rejeitado
  await withTenant(app, tA.id, (tx) => tx.debtorAccess.updateMany({ where: { debtorId: ana.debtorId, tenantId: tA.id }, data: { active: false } }));
  const revoked = await exchange(app, ana.token);
  record('acesso revogado é rejeitado', revoked === null, `após revoke, exchange = ${revoked === null ? 'null' : 'RESOLVEU'}`);

  // 5) link rotacionado: token antigo morre, novo funciona
  const newToken = genToken();
  await withTenant(app, tB.id, (tx) => tx.debtorAccess.updateMany({ where: { debtorId: bob.debtorId, tenantId: tB.id }, data: { tokenHash: hash(newToken), rotatedAt: new Date(), active: true } }));
  const oldDead = await exchange(app, bob.token);
  const newAlive = await exchange(app, newToken);
  record('rotação: token antigo morre, novo funciona', oldDead === null && newAlive?.debtorId === bob.debtorId,
    `antigo=${oldDead === null ? 'null' : 'vivo'} novo=${newAlive?.debtorId === bob.debtorId ? 'Bob' : 'falhou'}`);

  // 6) self-view: devedor só vê a própria dívida; cross-tenant é invisível
  const anaDebts = await withTenant(app, tA.id, (tx) => tx.debt.findMany({ where: { tenantId: tA.id, debtorId: ana.debtorId } }));
  const crossDebts = await withTenant(app, tA.id, (tx) => tx.debt.findMany({ where: { debtorId: bob.debtorId } }));
  record('self-view isolado (vê a própria; dívida de outro tenant é invisível pela RLS)',
    anaDebts.length === 1 && crossDebts.length === 0,
    `própria=${anaDebts.length} (esperado 1), dívida de Bob sob contexto A=${crossDebts.length} (esperado 0)`);

  // 7) auditoria isolada por tenant (RLS)
  const aEvents = await withTenant(app, tA.id, (tx) => tx.debtorLoginEvent.findMany());
  const bEvents = await withTenant(app, tB.id, (tx) => tx.debtorLoginEvent.findMany());
  record('auditoria de login isolada por tenant',
    aEvents.every((e) => e.tenantId === tA.id) && bEvents.every((e) => e.tenantId === tB.id) && aEvents.length >= 1,
    `A vê ${aEvents.length} evento(s) (só de A), B vê ${bEvents.length} (só de B)`);

  await app.$disconnect();
  await pg.stop();

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n=== RESULTADO: ${passed}/${checks.length} checks passaram ===`);
  process.exitCode = passed === checks.length ? 0 : 1;
}

main().catch((e) => {
  console.error('E2E_FAIL:', e);
  process.exit(1);
});
