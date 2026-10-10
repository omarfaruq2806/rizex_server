import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || 'unknown';
    const startTime = Date.now();

    // Skip high-frequency health check noise in info logs
    const isHealthCheck = originalUrl.includes('/health') || originalUrl.includes('/ping');

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';
      const duration = Date.now() - startTime;

      const logMessage = `[${method}] ${originalUrl} -> ${statusCode} (${duration}ms) | IP: ${ip} | Size: ${contentLength}b`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else if (!isHealthCheck) {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}

