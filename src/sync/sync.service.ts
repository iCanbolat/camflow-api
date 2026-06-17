import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  checklists,
  nextRowVersion,
  orgMembers,
  projectMembers,
  projectTasks,
} from '../database/schema';
import { NotificationService } from '../notifications/notification.service';
import { can, Permission } from '../organizations/permissions';
import { RedisService } from '../redis/redis.service';
import { PUSH_ENTITIES, SyncPolicy } from './entities';
import { PULL_ENTITIES, PullScope } from './pull-entities';
import { SyncPullQueryDto, SyncPushDto, SyncMutationDto } from './sync.dto';

const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60;

type Membership = typeof orgMembers.$inferSelect;

export interface MutationAck {
  id: string;
  entity: string;
  op: 'upsert' | 'delete';
  status: 'applied' | 'stale' | 'rejected';
  rowVersion?: number | null;
  /** Present on `stale`: the authoritative server row (LWW winner). */
  server?: Record<string, unknown>;
  message?: string;
  code?: string;
}

@Injectable()
export class SyncService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
  ) {}

  // --- Push -------------------------------------------------------------

  async push(accountId: string, dto: SyncPushDto) {
    const membershipCache = new Map<string, Membership | null>();
    const results: MutationAck[] = [];

    for (const mutation of dto.mutations) {
      try {
        results.push(
          await this.applyMutation(accountId, mutation, membershipCache),
        );
      } catch (e) {
        results.push({
          id: mutation.id,
          entity: mutation.entity,
          op: mutation.op,
          status: 'rejected',
          ...describeError(e),
        });
      }
    }

    return { results, serverTime: new Date().toISOString() };
  }

  private async applyMutation(
    accountId: string,
    m: SyncMutationDto,
    cache: Map<string, Membership | null>,
  ): Promise<MutationAck> {
    const def = PUSH_ENTITIES[m.entity];
    if (!def) {
      throw new BadRequestException({
        code: 'unknownEntity',
        message: `Unknown sync entity '${m.entity}'.`,
      });
    }

    // Replay-safe idempotency: return the cached ack if we've seen this key.
    const idemKey = `sync:idem:${m.idempotencyKey}`;
    const cached = await this.redis.client.get(idemKey);
    if (cached) return JSON.parse(cached) as MutationAck;

    const membership = await this.resolveMembership(
      accountId,
      m.organizationId,
      cache,
    );
    if (!membership) {
      throw new ForbiddenException({
        code: 'notMember',
        message: 'You are not a member of this organization.',
      });
    }

    const table = def.table;
    const [existing] = await this.db
      .select()
      .from(table)
      .where(eq(table.id, m.id))
      .limit(1);

    if (existing && existing.organizationId !== m.organizationId) {
      throw new ForbiddenException({
        code: 'orgMismatch',
        message: 'Entity belongs to a different organization.',
      });
    }

    const incoming = new Date(m.updatedAt).getTime();
    let ack: MutationAck;

    // Last-Write-Wins: an equal-or-newer server row wins; report it back.
    if (existing && new Date(existing.updatedAt).getTime() >= incoming) {
      ack = {
        id: m.id,
        entity: m.entity,
        op: m.op,
        status: 'stale',
        rowVersion: Number(existing.rowVersion),
        server: rowToJson(existing),
      };
    } else {
      await this.enforce(def.policy, m.op, membership, existing, m);
      ack = await this.write(def.table, m, existing);
      await this.publishChange(
        m.organizationId,
        m.entity,
        m.id,
        m.op,
        ack.rowVersion ?? null,
      );
      if (m.op === 'upsert') {
        await this.fanOut(m, existing, membership);
      }
    }

    await this.redis.client.set(
      idemKey,
      JSON.stringify(ack),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
    return ack;
  }

  private async write(
    table: any,
    m: SyncMutationDto,
    existing: any,
  ): Promise<MutationAck> {
    const updatedAt = new Date(m.updatedAt);
    const base = { id: m.id, entity: m.entity, op: m.op } as const;

    if (m.op === 'delete') {
      if (!existing) {
        // Never reached the server; nothing to tombstone.
        return { ...base, status: 'applied', rowVersion: null };
      }
      const [row] = (await this.db
        .update(table)
        .set({ deletedAt: updatedAt, updatedAt, rowVersion: nextRowVersion() })
        .where(eq(table.id, m.id))
        .returning()) as any[];
      return { ...base, status: 'applied', rowVersion: Number(row.rowVersion) };
    }

    const cols = PUSH_ENTITIES[m.entity].columns(m.payload ?? {});
    const payloadDeletedAt = m.payload?.deletedAt
      ? new Date(m.payload.deletedAt as string)
      : null;

    if (existing) {
      const [row] = (await this.db
        .update(table)
        .set({
          ...cols,
          deletedAt: payloadDeletedAt,
          updatedAt,
          rowVersion: nextRowVersion(),
        })
        .where(eq(table.id, m.id))
        .returning()) as any[];
      return { ...base, status: 'applied', rowVersion: Number(row.rowVersion) };
    }

    const createdAt = m.createdAt ? new Date(m.createdAt) : new Date();
    const [row] = (await this.db
      .insert(table)
      .values({
        id: m.id,
        organizationId: m.organizationId,
        ...cols,
        createdAt,
        updatedAt,
        deletedAt: payloadDeletedAt,
        rowVersion: nextRowVersion(),
      })
      .returning()) as any[];
    return { ...base, status: 'applied', rowVersion: Number(row.rowVersion) };
  }

  /** Role/ownership enforcement per entity policy. Throws on denial. */
  private async enforce(
    policy: SyncPolicy,
    op: 'upsert' | 'delete',
    membership: Membership,
    existing: any,
    _m: SyncMutationDto,
  ): Promise<void> {
    const role = membership.role;
    const deny = (message: string) =>
      new ForbiddenException({ code: 'forbidden', message });

    switch (policy) {
      case 'member':
        return;
      case 'taxonomy':
        if (!can(role, Permission.ManageTaxonomy)) {
          throw deny('Managing tags/labels/templates requires a manager role.');
        }
        return;
      case 'project':
        if (op === 'delete' && !can(role, Permission.DeleteProject)) {
          throw deny('Deleting a project requires a manager role.');
        }
        return;
      case 'task':
      case 'checklist':
        if (can(role, Permission.ManageTasks)) return;
        // Standard members may update work assigned to them.
        if (op === 'upsert' && existing?.assigneeMemberId === membership.id) {
          return;
        }
        throw deny('Managing tasks/checklists requires a manager role.');
      case 'checklistItem':
        if (can(role, Permission.ManageTasks)) return;
        if (op === 'upsert' && existing) {
          const parent = await this.db.query.checklists.findFirst({
            where: eq(checklists.id, existing.checklistId),
          });
          if (parent?.assigneeMemberId === membership.id) return;
        }
        throw deny('Managing checklist items requires a manager role.');
    }
  }

  /**
   * Triggers notification fan-out for assignment + comment mutations. The actor
   * is the pushing member; assignment fires only when the assignee changed.
   * Best-effort — a fan-out error never fails the mutation.
   */
  private async fanOut(
    m: SyncMutationDto,
    existing: any,
    membership: Membership,
  ): Promise<void> {
    const p = m.payload ?? {};
    try {
      if (m.entity === 'task') {
        const assignee = (p.assigneeMemberId as string) ?? null;
        if (assignee && (!existing || existing.assigneeMemberId !== assignee)) {
          await this.notifications.taskAssigned(
            m.organizationId,
            {
              id: m.id,
              assigneeMemberId: assignee,
              projectId: (p.projectId as string) ?? null,
              title: (p.title as string) ?? '',
            },
            membership.id,
          );
        }
      } else if (m.entity === 'checklist') {
        const assignee = (p.assigneeMemberId as string) ?? null;
        if (assignee && (!existing || existing.assigneeMemberId !== assignee)) {
          await this.notifications.checklistAssigned(
            m.organizationId,
            {
              id: m.id,
              assigneeMemberId: assignee,
              projectId: (p.projectId as string) ?? null,
              name: (p.name as string) ?? '',
            },
            membership.id,
          );
        }
      } else if (m.entity === 'taskComment' && !existing) {
        const task = await this.db.query.projectTasks.findFirst({
          where: eq(projectTasks.id, p.taskId as string),
        });
        if (task) {
          await this.notifications.taskComment(
            m.organizationId,
            {
              id: m.id,
              taskId: p.taskId as string,
              mentionIds: (p.mentionIds as string[]) ?? [],
              text: (p.text as string) ?? '',
            },
            {
              assigneeMemberId: task.assigneeMemberId,
              projectId: task.projectId,
            },
            membership.id,
          );
        }
      } else if (m.entity === 'photoComment' && !existing) {
        await this.notifications.photoComment(
          m.organizationId,
          {
            id: m.id,
            photoId: p.photoId as string,
            mentionIds: (p.mentionIds as string[]) ?? [],
            text: (p.text as string) ?? '',
          },
          membership.id,
        );
      }
    } catch {
      // Notification fan-out is best-effort.
    }
  }

  private async resolveMembership(
    accountId: string,
    orgId: string,
    cache: Map<string, Membership | null>,
  ): Promise<Membership | null> {
    if (cache.has(orgId)) return cache.get(orgId) ?? null;
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.accountId, accountId),
        eq(orgMembers.organizationId, orgId),
        isNull(orgMembers.deletedAt),
      ),
    });
    const result = member && member.status === 'active' ? member : null;
    cache.set(orgId, result);
    return result;
  }

  private async publishChange(
    orgId: string,
    entity: string,
    id: string,
    op: string,
    rowVersion: number | null,
  ) {
    try {
      await this.redis.publisher.publish(
        `org:${orgId}`,
        JSON.stringify({ entity, id, op, rowVersion }),
      );
    } catch {
      // Real-time fan-out is best-effort; pull remains the source of truth.
    }
  }

  // --- Pull -------------------------------------------------------------

  async pull(accountId: string, query: SyncPullQueryDto) {
    const orgId = query.organizationId;
    const since = query.since ?? 0;
    const limit = query.limit ?? 500;

    const membership = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.accountId, accountId),
        eq(orgMembers.organizationId, orgId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException({
        code: 'notMember',
        message: 'You are not a member of this organization.',
      });
    }

    const candidates: { key: string; rowVersion: number; row: any }[] = [];
    let capped = false;

    for (const [key, def] of Object.entries(PULL_ENTITIES)) {
      const table = def.table;
      const rows = await this.db
        .select()
        .from(table)
        .where(
          and(
            this.pullScope(def.scope, table, orgId, membership.id),
            gt(table.rowVersion, since),
          ),
        )
        .orderBy(asc(table.rowVersion))
        .limit(limit);
      if (rows.length === limit) capped = true;
      for (const row of rows) {
        candidates.push({ key, rowVersion: Number(row.rowVersion), row });
      }
    }

    candidates.sort((a, b) => a.rowVersion - b.rowVersion);
    const page = candidates.slice(0, limit);
    const hasMore = capped || candidates.length > limit;
    const nextCursor = page.length ? page[page.length - 1].rowVersion : since;

    const changes: Record<string, Record<string, unknown>[]> = {};
    for (const c of page) {
      (changes[c.key] ??= []).push(rowToJson(c.row));
    }

    await this.attachMemberProjects(changes);

    return { changes, nextCursor, hasMore };
  }

  private pullScope(
    scope: PullScope,
    table: any,
    orgId: string,
    membershipId: string,
  ) {
    switch (scope) {
      case 'self':
        return eq(table.id, orgId);
      case 'org':
        return eq(table.organizationId, orgId);
      case 'notification':
        return and(
          eq(table.organizationId, orgId),
          eq(table.recipientMemberId, membershipId),
        );
    }
  }

  /** Attach `projectIds` to pulled member rows (from the join table). */
  private async attachMemberProjects(
    changes: Record<string, Record<string, unknown>[]>,
  ) {
    const members = changes.member;
    if (!members?.length) return;
    const memberIds = members.map((m) => m.id as string);
    const links = await this.db
      .select()
      .from(projectMembers)
      .where(inArray(projectMembers.memberId, memberIds));

    const byMember = new Map<string, string[]>();
    for (const link of links) {
      const list = byMember.get(link.memberId) ?? [];
      list.push(link.projectId);
      byMember.set(link.memberId, list);
    }
    for (const member of members) {
      member.projectIds = byMember.get(member.id as string) ?? [];
    }
  }
}

/** Generic row → JSON: Date → ISO, bigint → number, tag as synced. */
function rowToJson(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = value.toISOString();
    else if (typeof value === 'bigint') out[key] = Number(value);
    else out[key] = value;
  }
  out.syncStatus = 'synced';
  return out;
}

function describeError(e: unknown): { message: string; code?: string } {
  if (e instanceof HttpException) {
    const res = e.getResponse();
    if (res && typeof res === 'object') {
      const r = res as Record<string, unknown>;
      return {
        message: (r.message as string) ?? e.message,
        code: r.code as string | undefined,
      };
    }
    return { message: e.message };
  }
  return { message: 'Internal error applying mutation.', code: 'internal' };
}
