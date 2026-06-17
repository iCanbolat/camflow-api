import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_CLEANUP } from '../queue/queue.constants';
import { CleanupScheduler } from './cleanup.scheduler';
import { CleanupService } from './cleanup.service';
import { CleanupWorker } from './cleanup.worker';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_CLEANUP })],
  providers: [CleanupService, CleanupWorker, CleanupScheduler],
  exports: [CleanupService],
})
export class CleanupModule {}
