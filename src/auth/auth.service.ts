import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { toAccountDto } from '../common/mappers';
import { DRIZZLE, type Database } from '../database/database.module';
import { accounts } from '../database/schema';
import { AppleService } from './apple.service';
import {
  AppleSignInDto,
  GoogleSignInDto,
  SignInDto,
  SignUpDto,
} from './auth.dto';
import { nameFromEmail, normalizeEmail, pickColor, RequestContext } from './auth.util';
import { GoogleService } from './google.service';
import { IssuedTokens, TokenService } from './token.service';

type AccountRow = typeof accounts.$inferSelect;
type AccountProvider = AccountRow['provider'];

export interface SessionResponse extends IssuedTokens {
  account: ReturnType<typeof toAccountDto>;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tokens: TokenService,
    private readonly apple: AppleService,
    private readonly google: GoogleService,
  ) {}

  async signUp(dto: SignUpDto, ctx: RequestContext): Promise<SessionResponse> {
    const email = normalizeEmail(dto.email);
    if (await this.findByEmail(email)) {
      throw new ConflictException({
        code: 'emailInUse',
        message: 'An account with this email already exists.',
      });
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const [account] = await this.db
      .insert(accounts)
      .values({
        email,
        displayName: dto.displayName?.trim() || nameFromEmail(email),
        provider: 'email',
        passwordHash,
        colorHex: pickColor(email),
      })
      .returning();
    return this.session(account, ctx);
  }

  async signIn(dto: SignInDto, ctx: RequestContext): Promise<SessionResponse> {
    const email = normalizeEmail(dto.email);
    const account = await this.findByEmail(email);
    if (!account) {
      throw new UnauthorizedException({
        code: 'accountNotFound',
        message: 'No account found for that email.',
      });
    }
    if (!account.passwordHash) {
      throw new UnauthorizedException({
        code: 'wrongPassword',
        message: 'This account uses a social sign-in provider.',
      });
    }
    const ok = await argon2.verify(account.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'wrongPassword',
        message: 'Incorrect password.',
      });
    }
    return this.session(account, ctx);
  }

  async appleSignIn(
    dto: AppleSignInDto,
    ctx: RequestContext,
  ): Promise<SessionResponse> {
    const { email } = await this.apple.verify(dto.identityToken);
    if (!email) {
      throw new UnauthorizedException('Apple did not return an email address.');
    }
    const account = await this.findOrCreate(
      'apple',
      normalizeEmail(email),
      dto.displayName,
    );
    return this.session(account, ctx);
  }

  async googleSignIn(
    dto: GoogleSignInDto,
    ctx: RequestContext,
  ): Promise<SessionResponse> {
    const { email, name } = await this.google.verify(dto.idToken);
    if (!email) {
      throw new UnauthorizedException('Google did not return an email address.');
    }
    const account = await this.findOrCreate('google', normalizeEmail(email), name);
    return this.session(account, ctx);
  }

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<SessionResponse> {
    const { accountId, tokens } = await this.tokens.rotate(refreshToken, ctx);
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });
    if (!account) throw new UnauthorizedException('Account unavailable.');
    return { account: toAccountDto(account), ...tokens };
  }

  async signOut(refreshToken: string): Promise<void> {
    await this.tokens.signOut(refreshToken);
  }

  private async session(
    account: AccountRow,
    ctx: RequestContext,
  ): Promise<SessionResponse> {
    const tokens = await this.tokens.issue(account.id, account.email, ctx);
    return { account: toAccountDto(account), ...tokens };
  }

  private findByEmail(email: string) {
    return this.db.query.accounts.findFirst({
      where: and(eq(accounts.email, email), isNull(accounts.deletedAt)),
    });
  }

  private async findOrCreate(
    provider: AccountProvider,
    email: string,
    displayName?: string,
  ): Promise<AccountRow> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    const [account] = await this.db
      .insert(accounts)
      .values({
        email,
        displayName: displayName?.trim() || nameFromEmail(email),
        provider,
        colorHex: pickColor(email),
      })
      .returning();
    return account;
  }
}
