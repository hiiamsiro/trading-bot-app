import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      password: hashedPassword,
      name: 'Demo User',
    },
  });

  console.log('Created demo user:', user.email);

  const bot = await prisma.bot.create({
    data: {
      name: 'Demo Bot',
      description: 'A demo trading bot',
      symbol: 'BTCUSD',
      status: 'STOPPED',
      userId: user.id,
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 10,
            longPeriod: 20,
          },
        },
      },
    },
  });

  console.log('Created demo bot:', bot.name);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
