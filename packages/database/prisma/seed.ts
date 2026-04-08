import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminNickname = 'Admin';
  const adminPassword = 'admin1234';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  console.log('Seeding admin user...');

  const admin = await prisma.player.upsert({
    where: { nickname: adminNickname },
    update: {
      password: hashedPassword,
      isAdmin: true,
      points: 1000000n,
    },
    create: {
      nickname: adminNickname,
      password: hashedPassword,
      isAdmin: true,
      points: 1000000n,
    },
  });

  console.log(`Admin created: ${admin.nickname} (ID: ${admin.id})`);
  console.log('Password: admin1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
