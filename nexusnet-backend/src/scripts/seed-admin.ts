import { env } from '@config/env';
import { prisma } from '@config/prisma';
import { hashPassword } from '@utils/crypto';

async function main() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_DISPLAY_NAME) {
    throw new Error('ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_DISPLAY_NAME are required');
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL.toLowerCase() },
    create: {
      email: env.ADMIN_EMAIL.toLowerCase(),
      username: env.ADMIN_USERNAME.toLowerCase(),
      displayName: env.ADMIN_DISPLAY_NAME,
      passwordHash,
      isVerified: true,
      mfaEnabled: false
    },
    update: {
      username: env.ADMIN_USERNAME.toLowerCase(),
      displayName: env.ADMIN_DISPLAY_NAME,
      passwordHash,
      isVerified: true,
      mfaEnabled: false,
      deletedAt: null
    }
  });

  console.log(`Admin user ready: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Failed to seed admin user', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });