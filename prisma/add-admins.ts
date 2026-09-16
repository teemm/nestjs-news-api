import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMINS = [
  { email: 'admin2@example.com', name: 'Second Admin', password: 'Admin2345' },
  { email: 'admin3@example.com', name: 'Third Admin', password: 'Admin3456' },
];

async function main(): Promise<void> {
  for (const admin of ADMINS) {
    const password = await bcrypt.hash(admin.password, 12);
    const user = await prisma.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name, role: Role.ADMIN, password },
      create: { ...admin, password, role: Role.ADMIN },
      select: { email: true, name: true, role: true },
    });

    console.log(`  ${user.email} / ${admin.password} (${user.role})`);
  }

  console.log('Done: 2 additional admin accounts are ready.');
}

main()
  .catch((error) => {
    console.error('Adding admins failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
