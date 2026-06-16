import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Holds the three Redis connections the app needs:
 *  - `client`     general commands (idempotency keys, caches) — Phase 2+
 *  - `publisher`  publishes change events to org channels       — Phase 4
 *  - `subscriber` dedicated SUBSCRIBE connection (cannot run other commands)
 *
 * BullMQ manages its own connections (see QueueModule).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  readonly publisher: Redis;
  readonly subscriber: Redis;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url, { maxRetriesPerRequest: null });
    this.publisher = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.client.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }
}
