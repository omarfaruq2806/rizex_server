import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { Throttle } from '@nestjs/throttler';

/**
 * Health Check Controller for Live Probes & Uptime Monitoring
 * 
 * Endpoints:
 * - GET /api/v1/health (Primary API health check)
 * - Checks: PostgreSQL Database Ping, Memory Heap, and Memory RSS limits
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Comprehensive Health Check endpoint (Compatible with UptimeRobot, BetterStack, AWS & Docker probes)
   */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60000 } }) // Allow up to 120 health pings per minute
  @HealthCheck()
  async check() {
    return this.health.check([
      // 1. Database Connection Check (Pings PostgreSQL via Prisma)
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // 2. Memory Heap Check (Alerts if memory heap exceeds 300MB)
      () => this.memoryHealth.checkHeap('memory_heap', 300 * 1024 * 1024),

      // 3. Memory RSS Check (Alerts if RSS memory exceeds 600MB)
      () => this.memoryHealth.checkRSS('memory_rss', 600 * 1024 * 1024),
    ]);
  }

  /**
   * Lightweight Liveness Probe (Instant response for load balancers)
   */
  @Get('ping')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  ping() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
