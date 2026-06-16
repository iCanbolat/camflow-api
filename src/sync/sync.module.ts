import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
