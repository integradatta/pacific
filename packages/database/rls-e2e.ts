/**
 * Validação end-to-end da RLS contra um Postgres REAL (embedded-postgres).
 * Sobe PG -> aplica migration.sql -> seed (2 tenants) -> aplica rls.sql ->
 * cria role app NÃO-superuser (RLS só vale para não-superuser/não-owner) ->
 * conecta como o app e prova: A vê só A; B vê só B; sem tenant -> vazio;
 * leitura e escrita cross-tenant falham. Replica o mecanismo de
 * TenantScopedService.withTenant (set_config local por transação).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import pkg from 'pg';
import { PrismaClient } from '@prisma/client';

const { Client } = pkg;
const PORT = 5433;
const SUPER_URL = `postgresql://postgres:postgres@localhost:${PORT}/pacific`;
const APP_URL = `postgresql://pacific_app:apppass@localhost:${PORT}/pacific`;

interface Check { name: string; pass: boolean; detail: string; }
const checks: Check[] = [];
const record = (name: string, pass: boolean, detail: string): void => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} · ${name} — ${detail}`);
};

async function withTenant<T>(prisma: PrismaClient, tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

// Aplica TODAS as migrações em ordem (0_init, 1_…, 2_…, 3_…) — espelha `prisma migrate deploy`.
async function applyMigrations(admin: InstanceType<typeof Client>): Promise<void> {
  const dir = 'packages/database/migrations';
  for (const name of readdirSync(dir).sort()) {
    const sql = `${dir}/${name}/migration.sql`;
    if (existsSync(sql)) await admin.query(readFileSync(sql, 'utf8'));
  }
}

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({ databaseDir: '/tmp/pacific-pg-e2e', user: 'postgres', password: 'postgres', port: PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('pacific');

  // 1) Schema (migration.sql) + role app + grants — via cliente superuser.
  const admin = new Client({ connectionString: SUPER_URL });
  await admin.connect();
  await applyMigrations(admin);
  await admin.query(`
    CREATE ROLE pacific_app LOGIN PASSWORD 'apppass' NOSUPERUSER;
    GRANT USAGE ON SCHEMA public TO pacific_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pacific_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pacific_app;
  `);

  // 2) Seed de 2 tenants (antes da RLS) via Prisma superuser.
  const su = new PrismaClient({ datasources: { db: { url: SUPER_URL } } });
  const tA = await su.tenant.create({ data: { name: 'Carteira A', orgCode: 'PAC-AAAA-0001' } });
  const tB = await su.tenant.create({ data: { name: 'Carteira B', orgCode: 'PAC-BBBB-0002' } });

  const seedDebtor = async (tenantId: string, name: string, email: string): Promise<string> => {
    const d = await su.debtor.create({ data: { tenantId, name, email } });
    await su.debt.create({
      data: { tenantId, debtorId: d.id, principal: '1000.00', rate: '0.03', ratePeriod: 'MONTHLY', startDate: new Date('2026-01-01T00:00:00Z'), dueDate: new Date('2026-03-01T00:00:00Z') },
    });
    return d.id;
  };
  await seedDebtor(tA.id, 'Ana', 'ana@a.com');
  await seedDebtor(tA.id, 'Bia', 'bia@a.com');
  await seedDebtor(tA.id, 'Caio', 'caio@a.com');
  const bDebtorId = await seedDebtor(tB.id, 'Dora', 'dora@b.com');
  await seedDebtor(tB.id, 'Eli', 'eli@b.com');
  await su.$disconnect();
  console.log(`Seed: tenant A=${tA.id} (3 devedores), tenant B=${tB.id} (2 devedores)`);

  // 3) Aplica rls.sql (ENABLE + FORCE + policies) como superuser.
  await admin.query(readFileSync('packages/database/src/rls.sql', 'utf8'));
  await admin.end();

  // 4) Validação conectado como o app (NÃO-superuser -> sujeito à RLS).
  const app = new PrismaClient({ datasources: { db: { url: APP_URL } } });

  // (a) A enxerga apenas A
  const aRows = await withTenant(app, tA.id, (tx) => tx.debtor.findMany());
  record('tenant A enxerga apenas dados de A', aRows.length === 3 && aRows.every((r) => r.tenantId === tA.id),
    `${aRows.length} devedores, tenantIds=${[...new Set(aRows.map((r) => r.tenantId))].join(',')} (esperado 3, só A)`);

  // (b) B enxerga apenas B
  const bRows = await withTenant(app, tB.id, (tx) => tx.debtor.findMany());
  record('tenant B enxerga apenas dados de B', bRows.length === 2 && bRows.every((r) => r.tenantId === tB.id),
    `${bRows.length} devedores, tenantIds=${[...new Set(bRows.map((r) => r.tenantId))].join(',')} (esperado 2, só B)`);

  // (c) sem tenant configurado -> nada
  const noCtx = await app.debtor.findMany();
  record('sem tenant configurado não retorna dados', noCtx.length === 0, `${noCtx.length} linhas (esperado 0)`);

  // (d) leitura cross-tenant: A tentando ler um devedor de B (por id) -> não encontra
  const cross = await withTenant(app, tA.id, (tx) => tx.debtor.findFirst({ where: { id: bDebtorId } }));
  record('leitura cross-tenant falha (A não lê devedor de B)', cross === null, `findFirst(idDeB) sob contexto A = ${cross === null ? 'null' : 'ENCONTROU'}`);

  // (e) escrita cross-tenant: A tentando inserir devedor com tenantId=B -> WITH CHECK bloqueia
  let writeBlocked = false;
  let writeDetail = 'INSERT cross-tenant foi PERMITIDO (falha de segurança)';
  try {
    await withTenant(app, tA.id, (tx) => tx.debtor.create({ data: { tenantId: tB.id, name: 'Intruso', email: 'x@b.com' } }));
  } catch (e) {
    writeBlocked = true;
    writeDetail = `bloqueado por RLS: ${(e as Error).message.split('\n')[0].slice(0, 90)}`;
  }
  record('escrita cross-tenant é bloqueada (WITH CHECK)', writeBlocked, writeDetail);

  // (f) confirmação extra: também vale para Debt
  const aDebts = await withTenant(app, tA.id, (tx) => tx.debt.findMany());
  const bDebts = await withTenant(app, tB.id, (tx) => tx.debt.findMany());
  record('isolamento também em Debt', aDebts.length === 3 && bDebts.length === 2 && aDebts.every((d) => d.tenantId === tA.id),
    `A=${aDebts.length} dívidas, B=${bDebts.length} dívidas (esperado 3 / 2)`);

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
