import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { devices } from '../database/schema';
import { RegisterDeviceDto } from './devices.dto';

@Injectable()
export class DevicesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Register (or re-point) an APNs token to the current account. */
  async register(accountId: string, dto: RegisterDeviceDto) {
    await this.db
      .insert(devices)
      .values({
        accountId,
        token: dto.token,
        platform: dto.platform ?? 'ios',
      })
      .onConflictDoUpdate({
        target: devices.token,
        set: {
          accountId,
          platform: dto.platform ?? 'ios',
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  }

  async unregister(accountId: string, token: string) {
    await this.db
      .delete(devices)
      .where(and(eq(devices.token, token), eq(devices.accountId, accountId)));
    return { ok: true };
  }
}
