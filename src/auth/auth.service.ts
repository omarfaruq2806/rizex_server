import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { auth } from './auth.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSessionFromHeaders(headers: Headers) {
    try {
      const session = await auth.api.getSession({
        headers,
      });
      if (session && session.user) return session;

      // Direct fallback: check Authorization header from database Session table
      const authHeader = headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        const dbSession = await this.prisma.session.findUnique({
          where: { token },
          include: { user: true },
        });

        if (dbSession && dbSession.expiresAt > new Date()) {
          return {
            session: dbSession,
            user: dbSession.user,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.debug('Failed to get session from headers', error);
      return null;
    }
  }

  async signUp(
    body: {
      email: string;
      password: string;
      name: string;
      role?: UserRole;
    },
    headers?: Headers,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: body.email.toLowerCase().trim(),
          password: body.password,
          name: body.name,
        },
        headers,
        asResponse: true,
      });

      // Update role if provided (default is CLIENT)
      if (body.role && body.role !== UserRole.CLIENT) {
        await this.prisma.user.update({
          where: { email: body.email.toLowerCase().trim() },
          data: { role: body.role },
        });
      }

      return response;
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to create user');
    }
  }

  async signIn(
    body: { email: string; password: string },
    headers?: Headers,
  ) {
    try {
      const response = await auth.api.signInEmail({
        body: {
          email: body.email.toLowerCase().trim(),
          password: body.password,
        },
        headers,
        asResponse: true,
      });
      return response;
    } catch (error: any) {
      throw new UnauthorizedException(
        error.message || 'Invalid email or password',
      );
    }
  }

  async signOut(headers: Headers) {
    try {
      return await auth.api.signOut({
        headers,
        asResponse: true,
      });
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to sign out');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }

    return user;
  }
}
