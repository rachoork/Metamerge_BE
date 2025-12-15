import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => ({
        app: {
          status: 'up',
          message: 'MetaMerge Backend is running',
        },
      }),
    ]);
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  readiness() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        openrouter: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing',
      },
    };
  }
}
