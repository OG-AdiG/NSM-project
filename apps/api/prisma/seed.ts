import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@nsm.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'NSM',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seed OK: admin ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
