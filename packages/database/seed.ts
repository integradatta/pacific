import { PrismaClient } from '@prisma/client';
import { generateOrgCode } from '@pacific/shared';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.user.create({ data: { supabaseId: 'seed-superadmin', email: 'admin@pacific.app', role: 'SUPER_ADMIN' } });

  const orgCode = generateOrgCode();
  const tenant = await prisma.tenant.create({ data: { name: 'Carteira Demo', orgCode } });
  await prisma.user.create({ data: { supabaseId: 'seed-creditor', email: 'credor@demo.app', role: 'CREDITOR', tenantId: tenant.id } });

  await prisma.debtor.create({ data: { tenantId: tenant.id, name: 'Ana Souza', email: 'ana@demo.app' } });
  await prisma.debtor.create({ data: { tenantId: tenant.id, name: 'Bruno Lima', email: 'bruno@demo.app' } });

  console.log(`Seed ok. orgCode da carteira demo: ${orgCode}`);
}
main().finally(() => void prisma.$disconnect());
