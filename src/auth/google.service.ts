import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/** Verifies a Google id token (from Sign in with Google) and returns identity. */
@Injectable()
export class GoogleService {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(
    idToken: string,
  ): Promise<{ sub: string; email?: string; name?: string }> {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID') || undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('Empty Google token payload.');
      return { sub: payload.sub, email: payload.email, name: payload.name };
    } catch {
      throw new UnauthorizedException('Invalid Google id token.');
    }
  }
}
