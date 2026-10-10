import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'dev_secret_key_rizex_1234567890',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  basePath: '/api/v1/auth',

  // Authentication Strategy
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  // Social Authentication Providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },

  // Session & Token Management:
  // - Session duration: 7 days
  // - Refresh/Update threshold: Every 24 hours
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    updateAge: 60 * 60 * 24, // 1 day in seconds
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache for high-throughput reads
    },
  },

  // Secure Cookie Policy:
  // - httpOnly: Prevents client-side JS XSS cookie theft
  // - secure: Enforces HTTPS in production
  // - sameSite: 'none' with secure in cross-origin production, 'lax' for local dev
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      httpOnly: true,
    },
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
    'http://127.0.0.1:3000',
    'https://rizex.vercel.app',
    'https://*.vercel.app',
  ],
});
