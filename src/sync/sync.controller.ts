import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { SyncPullQueryDto, SyncPushDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Push a batch of local mutations. Returns a per-item ack (applied/stale/rejected). */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  push(@CurrentUser() user: AuthUser, @Body() dto: SyncPushDto) {
    return this.sync.push(user.id, dto);
  }

  /** Pull the delta of changes for an org since a row_version cursor. */
  @Get('pull')
  pull(@CurrentUser() user: AuthUser, @Query() query: SyncPullQueryDto) {
    return this.sync.pull(user.id, query);
  }
}
