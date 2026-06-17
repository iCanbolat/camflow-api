import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_CLEANUP } from '../queue/queue.constants';
import {
  CLEANUP_JOB_REFRESH_TOKENS,
  CLEANUP_JOB_TOMBSTONES,
} from './cleanup.constants';
import { CleanupService } from './cleanup.service';

@Processor(QUEUE_CLEANUP)
export class CleanupWorker extends WorkerHost {
  private readonly logger = new Logger(CleanupWorker.name);

  constructor(private readonly cleanup: CleanupService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case CLEANUP_JOB_REFRESH_TOKENS:
        await this.cleanup.purgeRefreshTokens();
        break;
      case CLEANUP_JOB_TOMBSTONES:
        await this.cleanup.pruneTombstones();
        break;
      default:
        this.logger.warn(`Unknown cleanup job '${job.name}'.`);
    }
  }
}
