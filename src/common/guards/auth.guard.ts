import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Convert Express headers to standard Web Headers
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

    const session = await this.authService.getSessionFromHeaders(headers);

    if (!session || !session.user) {
      throw new UnauthorizedException('Authentication required. Please log in.');
    }

    // Attach authenticated user and session to request
    (request as any).user = session.user;
    (request as any).session = session.session;

    return true;
  }
}
