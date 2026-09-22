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
      return session;
    } catch (error) {
      this.logger.debug('Failed to get session from headers', error);
      return null;
    }
  }

  async signUp(body: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: body.email.toLowerCase().trim(),
          password: body.password,
          name: body.name,
        },
      });

      // Update role if provided (default is CLIENT)
      if (body.role && body.role !== UserRole.CLIENT) {
        await this.prisma.user.update({
          where: { email: body.email.toLowerCase().trim() },
          data: { role: body.role },
        });
      }

      return result;
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to create user');
    }
  }

  async signIn(body: { email: string; password: string }) {
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: body.email.toLowerCase().trim(),
          password: body.password,
        },
      });
      return result;
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
