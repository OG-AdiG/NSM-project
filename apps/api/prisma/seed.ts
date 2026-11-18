import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@nsm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const artistEmail = process.env.SEED_ARTIST_EMAIL ?? 'artysta@nsm.local';
  const artistPassword = process.env.SEED_ARTIST_PASSWORD ?? 'Artysta123!';

  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'NSM',
      emailVerifiedAt: new Date(),
    },
  });

  const artistHash = await argon2.hash(artistPassword, { type: argon2.argon2id });
  const artist = await prisma.user.upsert({
    where: { email: artistEmail },
    update: {},
    create: {
      email: artistEmail,
      passwordHash: artistHash,
      role: Role.ARTIST,
      firstName: 'Kasia',
      lastName: 'Linia',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.artistProfile.upsert({
    where: { userId: artist.id },
    update: {
      displayName: 'Kasia Linia',
      styles: ['fineline', 'minimal', 'botaniczny'],
      bio: 'Specjalizacja: delikatne linie i motywy botaniczne.',
      active: true,
    },
    create: {
      userId: artist.id,
      displayName: 'Kasia Linia',
      styles: ['fineline', 'minimal', 'botaniczny'],
      bio: 'Specjalizacja: delikatne linie i motywy botaniczne.',
      active: true,
    },
  });

  console.log(`Seed OK: admin ${adminEmail} / ${adminPassword}`);
  console.log(`Seed OK: artysta ${artistEmail} / ${artistPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
