import {
  Controller,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * SSE stream of change signals for an org. Authenticated (bearer token) and
   * membership-gated via OrgScopeGuard. The iOS client opens this and calls
   * `/sync/pull` on each `change` event.
   */
  @Sse(':orgId')
  @UseGuards(OrgScopeGuard)
  stream(
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Observable<MessageEvent> {
    return this.realtime.streamFor(orgId);
  }
}
