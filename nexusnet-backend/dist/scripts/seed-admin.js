"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
const prisma_1 = require("../config/prisma");
const crypto_1 = require("../utils/crypto");
async function main() {
    if (!env_1.env.ADMIN_EMAIL || !env_1.env.ADMIN_USERNAME || !env_1.env.ADMIN_PASSWORD || !env_1.env.ADMIN_DISPLAY_NAME) {
        throw new Error('ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_DISPLAY_NAME are required');
    }
    const passwordHash = await (0, crypto_1.hashPassword)(env_1.env.ADMIN_PASSWORD);
    const admin = await prisma_1.prisma.user.upsert({
        where: { email: env_1.env.ADMIN_EMAIL.toLowerCase() },
        create: {
            email: env_1.env.ADMIN_EMAIL.toLowerCase(),
            username: env_1.env.ADMIN_USERNAME.toLowerCase(),
            displayName: env_1.env.ADMIN_DISPLAY_NAME,
            passwordHash,
            isVerified: true,
            mfaEnabled: false
        },
        update: {
            username: env_1.env.ADMIN_USERNAME.toLowerCase(),
            displayName: env_1.env.ADMIN_DISPLAY_NAME,
            passwordHash,
            isVerified: true,
            mfaEnabled: false,
            deletedAt: null
        }
    });
    console.log(`Admin user ready: ${admin.email}`);
}
main()
    .catch((error) => {
    console.error('Failed to seed admin user', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
