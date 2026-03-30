import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[seed] ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

const ADMIN_EMAIL = requireEnv('SEED_ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('SEED_ADMIN_PASSWORD');

async function main() {
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: 'Admin', password, isAdmin: true },
    create: { email: ADMIN_EMAIL, password, name: 'Admin', isAdmin: true },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: { plan: 'PREMIUM', status: 'ACTIVE' },
    create: { userId: admin.id, plan: 'PREMIUM', status: 'ACTIVE', currentPeriodEnd: new Date('2099-12-31') },
  });
  console.log(`[seed] Admin account ready: ${ADMIN_EMAIL}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
