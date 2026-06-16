import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

/** Verifies the Sign in with Apple identity token against Apple's JWKS. */
@Injectable()
export class AppleService {
  constructor(private readonly config: ConfigService) {}

  async verify(
    identityToken: string,
  ): Promise<{ sub: string; email?: string }> {
    const audience = this.config.get<string>('APPLE_CLIENT_ID') || undefined;
    try {
      const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer: APPLE_ISSUER,
        audience,
      });
      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };
    } catch {
      throw new UnauthorizedException('Invalid Apple identity token.');
    }
  }
}
