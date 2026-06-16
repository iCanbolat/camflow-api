import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { accounts, refreshTokens } from '../database/schema';
import { parseDurationSeconds, RequestContext } from './auth.util';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
  refreshToken: string;
  refreshTokenExpiresAt: string; // ISO
}

/**
 * Access tokens are short-lived JWTs (kept in RAM on the client). Refresh
 * tokens are opaque `<rowId>.<secret>` strings; only the argon2 hash of the
 * secret is stored. Refreshing rotates the row and issues a new token in the
 * same family. Presenting an already-rotated token = reuse → revoke the family.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async issue(
    accountId: string,
    email: string,
    ctx: RequestContext = {},
    familyId?: string,
  ): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync({ sub: accountId, email });
    const refresh = await this.issueRefresh(accountId, ctx, familyId);
    return {
      accessToken,
      accessTokenExpiresIn: parseDurationSeconds(
        this.config.get<string>('JWT_ACCESS_TTL', '15m'),
      ),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
    };
  }

  /** Rotates a presented refresh token, with reuse detection. */
  async rotate(
    presented: string,
    ctx: RequestContext = {},
  ): Promise<{ accountId: string; tokens: IssuedTokens }> {
    const { id, secret } = this.parse(presented);

    const row = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, id),
    });
    if (!row) throw new UnauthorizedException('Invalid refresh token.');
    if (row.revokedAt) throw new UnauthorizedException('Refresh token revoked.');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    const valid = await argon2.verify(row.tokenHash, secret);
    if (!valid) throw new UnauthorizedException('Invalid refresh token.');

    if (row.rotatedAt) {
      // Reuse of an already-rotated token → likely theft. Burn the family.
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Refresh token reuse detected.');
    }

    const account = await this.db.query.accounts.findFirst({
      where: and(eq(accounts.id, row.accountId), isNull(accounts.deletedAt)),
    });
    if (!account) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Account unavailable.');
    }

    await this.db
      .update(refreshTokens)
      .set({ rotatedAt: new Date() })
      .where(eq(refreshTokens.id, id));

    const tokens = await this.issue(
      account.id,
      account.email,
      ctx,
      row.familyId,
    );
    return { accountId: account.id, tokens };
  }

  /** Revokes the family of the presented token (sign-out). Best-effort. */
  async signOut(presented: string): Promise<void> {
    let parsed: { id: string };
    try {
      parsed = this.parse(presented);
    } catch {
      return;
    }
    const row = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, parsed.id),
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  private async issueRefresh(
    accountId: string,
    ctx: RequestContext,
    familyId?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const id = randomUUID();
    const family = familyId ?? randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = await argon2.hash(secret, { type: argon2.argon2id });
    const days = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 60);
    const expiresAt = new Date(Date.now() + days * 86_400_000);

    await this.db.insert(refreshTokens).values({
      id,
      accountId,
      familyId: family,
      tokenHash,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      expiresAt,
    });

    return { token: `${id}.${secret}`, expiresAt };
  }

  private parse(presented: string): { id: string; secret: string } {
    const dot = presented.indexOf('.');
    if (dot <= 0 || dot === presented.length - 1) {
      throw new UnauthorizedException('Malformed refresh token.');
    }
    return { id: presented.slice(0, dot), secret: presented.slice(dot + 1) };
  }
}
