import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  All,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { auth } from './auth.config.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Rate limited: Max 5 registration attempts per minute per IP address
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() dto: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, String(v)));
        } else {
          headers.set(key, String(value));
        }
      }
    });

    const authRes = await this.authService.signUp(dto, headers);
    const setCookieHeaders = (authRes.headers as any).getSetCookie
      ? (authRes.headers as any).getSetCookie()
      : authRes.headers.get('set-cookie');

    if (setCookieHeaders) {
      res.setHeader('Set-Cookie', setCookieHeaders);
    }

    const data = await authRes.json();
    return data;
  }

  /**
   * Rate limited: Max 5 login attempts per minute per IP address (brute-force defense)
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, String(v)));
        } else {
          headers.set(key, String(value));
        }
      }
    });

    const authRes = await this.authService.signIn(dto, headers);
    const setCookieHeaders = (authRes.headers as any).getSetCookie
      ? (authRes.headers as any).getSetCookie()
      : authRes.headers.get('set-cookie');

    if (setCookieHeaders) {
      res.setHeader('Set-Cookie', setCookieHeaders);
    }

    const data = await authRes.json();
    return data;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, String(v)));
        } else {
          headers.set(key, String(value));
        }
      }
    });

    const authRes = await this.authService.signOut(headers);
    const setCookieHeaders = (authRes.headers as any).getSetCookie
      ? (authRes.headers as any).getSetCookie()
      : authRes.headers.get('set-cookie');

    if (setCookieHeaders) {
      res.setHeader('Set-Cookie', setCookieHeaders);
    }

    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
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
      return { user: null };
    }

    const profile = await this.authService.getProfile(session.user.id);
    return { user: profile };
  }

  // Fallback wildcard handler for direct Better Auth API client calls
  @All('*')
  async handleBetterAuth(@Req() req: Request, @Res() res: Response) {
    return toNodeHandler(auth)(req, res);
  }
}
