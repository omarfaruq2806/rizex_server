import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'dev_secret_key_rizex_1234567890',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  basePath: '/api/v1/auth',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'CLIENT',
        input: false,
      },
    },
  },
  trustedOrigins: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3000',
  ],
});
