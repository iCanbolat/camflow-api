import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisOptions } from '../redis/redis.util';
import {
  QUEUE_CLEANUP,
  QUEUE_MEDIA_PROCESS,
  QUEUE_PUSH_SEND,
} from './queue.constants';

/**
 * Registers the BullMQ root connection and the app's queues. Workers/processors
 * are added by their owning modules in later phases; this only declares the
 * queues and shared connection. Default job options favour resilient retries.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptions(config.getOrThrow<string>('REDIS_URL')),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_MEDIA_PROCESS },
      { name: QUEUE_PUSH_SEND },
      { name: QUEUE_CLEANUP },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
