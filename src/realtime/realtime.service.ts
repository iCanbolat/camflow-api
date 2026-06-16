import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { interval, merge, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

const CHANNEL_PATTERN = 'org:*';
const HEARTBEAT_MS = 25_000;

interface ChangeEvent {
  orgId: string;
  entity: string;
  id: string;
  op: string;
  rowVersion: number | null;
}

/**
 * Bridges Redis Pub/Sub → SSE. A single `psubscribe('org:*')` feeds an RxJS
 * Subject; each SSE connection filters it by its org. Clients react to a signal
 * by calling `/sync/pull` (pull stays the source of truth).
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly events$ = new Subject<ChangeEvent>();

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    await this.redis.subscriber.psubscribe(CHANNEL_PATTERN);
    this.redis.subscriber.on('pmessage', (_pattern, channel, message) => {
      const orgId = channel.slice('org:'.length);
      try {
        const data = JSON.parse(message);
        this.events$.next({ orgId, ...data });
      } catch {
        this.logger.warn(`Bad change payload on ${channel}`);
      }
    });
  }

  async onModuleDestroy() {
    this.events$.complete();
    await this.redis.subscriber.punsubscribe(CHANNEL_PATTERN).catch(() => undefined);
  }

  /** SSE stream for one org: change signals + periodic heartbeats. */
  streamFor(orgId: string): Observable<MessageEvent> {
    const changes = this.events$.pipe(
      filter((e) => e.orgId === orgId),
      map(
        (e): MessageEvent => ({
          type: 'change',
          data: { entity: e.entity, id: e.id, op: e.op, rowVersion: e.rowVersion },
        }),
      ),
    );
    const heartbeats = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { ts: Date.now() } })),
    );
    return merge(changes, heartbeats);
  }
}
