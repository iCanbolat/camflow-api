import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_CLEANUP } from '../queue/queue.constants';
import {
  CLEANUP_JOB_REFRESH_TOKENS,
  CLEANUP_JOB_TOMBSTONES,
} from './cleanup.constants';

/**
 * Registers the repeatable retention jobs once the app is up. BullMQ dedupes
 * repeatable jobs by their repeat key, so re-asserting on every boot is safe.
 */
@Injectable()
export class CleanupScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(
    @InjectQueue(QUEUE_CLEANUP) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('CLEANUP_ENABLED') === 'false') return;
    try {
      await this.queue.add(
        CLEANUP_JOB_REFRESH_TOKENS,
        {},
        {
          repeat: { pattern: '15 3 * * *' },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
      await this.queue.add(
        CLEANUP_JOB_TOMBSTONES,
        {},
        {
          repeat: { pattern: '30 3 * * *' },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
      this.logger.log('Scheduled daily cleanup jobs.');
    } catch (e) {
      this.logger.warn(
        `Could not schedule cleanup jobs: ${(e as Error).message}`,
      );
    }
  }
}
