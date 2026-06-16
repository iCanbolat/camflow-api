import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { Public } from '../common/decorators';
import { DRIZZLE, type Database } from '../database/database.module';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute(sql`select 1`);
      return { database: { status: 'up' } };
    } catch (e) {
      throw new HealthCheckError('Database unavailable', {
        database: { status: 'down', message: (e as Error).message },
      });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.client.ping();
      if (pong !== 'PONG') throw new Error(`unexpected ping reply: ${pong}`);
      return { redis: { status: 'up' } };
    } catch (e) {
      throw new HealthCheckError('Redis unavailable', {
        redis: { status: 'down', message: (e as Error).message },
      });
    }
  }
}
