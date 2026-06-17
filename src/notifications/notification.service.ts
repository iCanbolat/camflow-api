import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  appNotifications,
  nextRowVersion,
  orgMembers,
} from '../database/schema';
import { QUEUE_PUSH_SEND } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';

type NotificationKind =
  | 'taskAssigned'
  | 'checklistAssigned'
  | 'mention'
  | 'comment';

interface CreateInput {
  organizationId: string;
  recipientMemberId: string;
  actorMemberId: string | null;
  kind: NotificationKind;
  taskId?: string | null;
  checklistId?: string | null;
  photoId?: string | null;
  projectId?: string | null;
  bodySnippet: string;
}

const SNIPPET = 160;

/**
 * Server-side notification fan-out, mirroring the iOS `NotificationStore`.
 * Called by the sync engine when relevant mutations are applied. Persists
 * `app_notifications` rows (delivered via sync pull), publishes a realtime
 * signal, and enqueues an APNs push. The actor never notifies themselves.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_PUSH_SEND) private readonly pushQueue: Queue,
  ) {}

  async taskAssigned(
    orgId: string,
    task: {
      id: string;
      assigneeMemberId: string | null;
      projectId?: string | null;
      title: string;
    },
    actorId: string | null,
  ) {
    if (!task.assigneeMemberId || task.assigneeMemberId === actorId) return;
    await this.create({
      organizationId: orgId,
      recipientMemberId: task.assigneeMemberId,
      actorMemberId: actorId,
      kind: 'taskAssigned',
      taskId: task.id,
      projectId: task.projectId ?? null,
      bodySnippet: task.title,
    });
  }

  async checklistAssigned(
    orgId: string,
    checklist: {
      id: string;
      assigneeMemberId: string | null;
      projectId?: string | null;
      name: string;
    },
    actorId: string | null,
  ) {
    if (!checklist.assigneeMemberId || checklist.assigneeMemberId === actorId)
      return;
    await this.create({
      organizationId: orgId,
      recipientMemberId: checklist.assigneeMemberId,
      actorMemberId: actorId,
      kind: 'checklistAssigned',
      checklistId: checklist.id,
      projectId: checklist.projectId ?? null,
      bodySnippet: checklist.name,
    });
  }

  async taskComment(
    orgId: string,
    comment: { id: string; taskId: string; mentionIds: string[]; text: string },
    task: { assigneeMemberId: string | null; projectId: string | null },
    actorId: string | null,
  ) {
    // Mentioned members get 'mention'; the assignee gets 'comment' (unless
    // already mentioned). The actor is always skipped.
    const recipients = new Map<string, NotificationKind>();
    for (const id of comment.mentionIds) {
      if (id !== actorId) recipients.set(id, 'mention');
    }
    if (
      task.assigneeMemberId &&
      task.assigneeMemberId !== actorId &&
      !recipients.has(task.assigneeMemberId)
    ) {
      recipients.set(task.assigneeMemberId, 'comment');
    }
    for (const [recipientMemberId, kind] of recipients) {
      await this.create({
        organizationId: orgId,
        recipientMemberId,
        actorMemberId: actorId,
        kind,
        taskId: comment.taskId,
        projectId: task.projectId,
        bodySnippet: comment.text.slice(0, SNIPPET),
      });
    }
  }

  async photoComment(
    orgId: string,
    comment: {
      id: string;
      photoId: string;
      mentionIds: string[];
      text: string;
    },
    actorId: string | null,
  ) {
    for (const recipientMemberId of comment.mentionIds) {
      if (recipientMemberId === actorId) continue;
      await this.create({
        organizationId: orgId,
        recipientMemberId,
        actorMemberId: actorId,
        kind: 'mention',
        photoId: comment.photoId,
        bodySnippet: comment.text.slice(0, SNIPPET),
      });
    }
  }

  // --- read state (called by the controller) ---------------------------

  async markRead(accountId: string, notificationId: string) {
    const notification = await this.db.query.appNotifications.findFirst({
      where: eq(appNotifications.id, notificationId),
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    await this.assertRecipient(accountId, notification.recipientMemberId);

    const [row] = await this.db
      .update(appNotifications)
      .set({ isRead: true, readAt: new Date(), rowVersion: nextRowVersion() })
      .where(eq(appNotifications.id, notificationId))
      .returning();
    await this.publish(
      notification.organizationId,
      notification.id,
      Number(row.rowVersion),
    );
    return { id: notificationId, isRead: true };
  }

  async markAllRead(accountId: string, organizationId: string) {
    const membership = await this.requireMembership(accountId, organizationId);
    const rows = await this.db
      .update(appNotifications)
      .set({ isRead: true, readAt: new Date(), rowVersion: nextRowVersion() })
      .where(
        and(
          eq(appNotifications.recipientMemberId, membership.id),
          eq(appNotifications.isRead, false),
          isNull(appNotifications.deletedAt),
        ),
      )
      .returning();
    if (rows.length) await this.publish(organizationId, 'all', null);
    return { updated: rows.length };
  }

  async unreadCount(accountId: string, organizationId: string) {
    const membership = await this.requireMembership(accountId, organizationId);
    const [row] = await this.db
      .select({ value: count() })
      .from(appNotifications)
      .where(
        and(
          eq(appNotifications.recipientMemberId, membership.id),
          eq(appNotifications.isRead, false),
          isNull(appNotifications.deletedAt),
        ),
      );
    return { unread: Number(row?.value ?? 0) };
  }

  // --- internals -------------------------------------------------------

  private async create(input: CreateInput) {
    const [row] = await this.db
      .insert(appNotifications)
      .values({
        organizationId: input.organizationId,
        recipientMemberId: input.recipientMemberId,
        actorMemberId: input.actorMemberId,
        kind: input.kind,
        taskId: input.taskId ?? null,
        checklistId: input.checklistId ?? null,
        photoId: input.photoId ?? null,
        projectId: input.projectId ?? null,
        bodySnippet: input.bodySnippet,
      })
      .returning();

    await this.publish(input.organizationId, row.id, Number(row.rowVersion));
    await this.pushQueue
      .add('send', { notificationId: row.id })
      .catch(() => undefined);
    return row;
  }

  private async assertRecipient(accountId: string, recipientMemberId: string) {
    const member = await this.db.query.orgMembers.findFirst({
      where: eq(orgMembers.id, recipientMemberId),
    });
    if (!member || member.accountId !== accountId) {
      throw new ForbiddenException('Not your notification.');
    }
  }

  private async requireMembership(accountId: string, organizationId: string) {
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.accountId, accountId),
        eq(orgMembers.organizationId, organizationId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException(
        'You are not a member of this organization.',
      );
    }
    return member;
  }

  private async publish(orgId: string, id: string, rowVersion: number | null) {
    try {
      await this.redis.publisher.publish(
        `org:${orgId}`,
        JSON.stringify({
          entity: 'notification',
          id,
          op: 'upsert',
          rowVersion,
        }),
      );
    } catch {
      // best-effort
    }
  }
}
