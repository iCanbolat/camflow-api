import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { NotificationService } from './notification.service';

class OrgScopeQuery {
  @IsUUID()
  organizationId: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser, @Query() q: OrgScopeQuery) {
    return this.notifications.unreadCount(user.id, q.organizationId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: AuthUser, @Query() q: OrgScopeQuery) {
    return this.notifications.markAllRead(user.id, q.organizationId);
  }
}
