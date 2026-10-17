import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/database/seed/seed-data';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('Skip seed: users already exist');
    return;
  }
  await seedDatabase(prisma as never);
  console.log('Seed OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
