import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, String(v)));
        } else {
          headers.set(key, String(value));
        }
      }
    });

    const queryToken = request.query?.token as string | undefined;
    if (queryToken && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${queryToken}`);
    }

    try {
      const session = await this.authService.getSessionFromHeaders(headers);
      if (session && session.user) {
        (request as any).user = session.user;
        (request as any).session = session.session;
      }
    } catch {
      // Ignore auth failure for optional routes
    }

    return true;
  }
}
