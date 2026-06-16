import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_PUSH_SEND } from '../queue/queue.constants';
import { ApnsService } from './apns.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PushSendWorker } from './push-send.worker';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_PUSH_SEND })],
  controllers: [DevicesController],
  providers: [ApnsService, DevicesService, PushSendWorker],
})
export class PushModule {}
