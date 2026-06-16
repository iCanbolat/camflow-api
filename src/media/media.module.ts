import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_MEDIA_PROCESS } from '../queue/queue.constants';
import { MediaController } from './media.controller';
import { MediaProcessWorker } from './media-process.worker';
import { MediaService } from './media.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_MEDIA_PROCESS })],
  controllers: [MediaController],
  providers: [MediaService, MediaProcessWorker],
})
export class MediaModule {}
