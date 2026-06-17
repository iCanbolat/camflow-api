import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { appNotifications, devices, orgMembers } from '../database/schema';
import { QUEUE_PUSH_SEND } from '../queue/queue.constants';
import { ApnsService } from './apns.service';

interface PushJob {
  notificationId: string;
}

type Notification = typeof appNotifications.$inferSelect;

/**
 * Delivers a notification to the recipient's registered devices via APNs, with
 * an app-icon badge = unread count and a deep link. No-ops cleanly when APNs is
 * unconfigured. Prunes tokens APNs reports as invalid.
 */
@Processor(QUEUE_PUSH_SEND, { concurrency: 5 })
export class PushSendWorker extends WorkerHost {
  private readonly logger = new Logger(PushSendWorker.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly apns: ApnsService,
  ) {
    super();
  }

  async process(job: Job<PushJob>): Promise<void> {
    if (!this.apns.configured) return;

    const notification = await this.db.query.appNotifications.findFirst({
      where: eq(appNotifications.id, job.data.notificationId),
    });
    if (!notification) return;

    const recipient = await this.db.query.orgMembers.findFirst({
      where: eq(orgMembers.id, notification.recipientMemberId),
    });
    if (!recipient?.accountId) return;

    const targets = await this.db
      .select()
      .from(devices)
      .where(eq(devices.accountId, recipient.accountId));
    if (!targets.length) return;

    const [{ value: unread }] = await this.db
      .select({ value: count() })
      .from(appNotifications)
      .where(
        and(
          eq(appNotifications.recipientMemberId, recipient.id),
          eq(appNotifications.isRead, false),
          isNull(appNotifications.deletedAt),
        ),
      );

    const actor = notification.actorMemberId
      ? await this.db.query.orgMembers.findFirst({
          where: eq(orgMembers.id, notification.actorMemberId),
        })
      : null;

    const { title, body } = alertText(notification, actor?.name);
    const payload = {
      aps: { alert: { title, body }, badge: Number(unread), sound: 'default' },
      deepLink: deepLink(notification),
      notificationId: notification.id,
    };

    for (const device of targets) {
      const res = await this.apns
        .send(device.token, payload, {
          collapseId: notification.id.slice(0, 60),
        })
        .catch(() => ({ ok: false, status: 0, reason: 'error' }));
      if (
        res.status === 410 ||
        res.reason === 'BadDeviceToken' ||
        res.reason === 'Unregistered'
      ) {
        await this.db.delete(devices).where(eq(devices.token, device.token));
        this.logger.log(
          `Pruned invalid device token for ${recipient.accountId}.`,
        );
      }
    }
  }
}

function alertText(
  n: Notification,
  actorName?: string,
): { title: string; body: string } {
  const who = actorName ?? 'Someone';
  switch (n.kind) {
    case 'taskAssigned':
      return { title: 'New task assigned', body: n.bodySnippet };
    case 'checklistAssigned':
      return { title: 'New checklist assigned', body: n.bodySnippet };
    case 'mention':
      return { title: `${who} mentioned you`, body: n.bodySnippet };
    case 'comment':
      return { title: `${who} commented`, body: n.bodySnippet };
    default:
      return { title: 'CamFlow', body: n.bodySnippet };
  }
}

function deepLink(n: Notification): string {
  if (n.taskId) return `camflow://task/${n.taskId}`;
  if (n.checklistId) return `camflow://checklist/${n.checklistId}`;
  if (n.photoId) return `camflow://photo/${n.photoId}`;
  return 'camflow://notifications';
}
