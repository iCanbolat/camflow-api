import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import http2 from 'http2';
import { importPKCS8, SignJWT } from 'jose';

export interface ApnsResult {
  ok: boolean;
  status: number;
  reason?: string;
}

/**
 * APNs HTTP/2 sender with token-based (.p8) auth. A no-op until APNS_* are
 * configured, so the rest of the pipeline runs unchanged in dev. The provider
 * JWT is cached (~50 min, well under Apple's 60-min limit).
 */
@Injectable()
export class ApnsService {
  private readonly logger = new Logger(ApnsService.name);
  private cachedJwt?: { token: string; iat: number };

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('APNS_KEY_P8') &&
      this.config.get('APNS_KEY_ID') &&
      this.config.get('APNS_TEAM_ID') &&
      this.config.get('APNS_BUNDLE_ID'),
    );
  }

  async send(
    deviceToken: string,
    payload: object,
    opts: { collapseId?: string; pushType?: string } = {},
  ): Promise<ApnsResult> {
    if (!this.configured)
      return { ok: false, status: 0, reason: 'not-configured' };

    const jwt = await this.authToken();
    const host =
      this.config.get('APNS_PRODUCTION') === 'true'
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com';
    return this.post(host, deviceToken, jwt, payload, opts);
  }

  private async authToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedJwt && now - this.cachedJwt.iat < 3000) {
      return this.cachedJwt.token;
    }
    const keyId = this.config.getOrThrow<string>('APNS_KEY_ID');
    const teamId = this.config.getOrThrow<string>('APNS_TEAM_ID');
    const p8 = this.config
      .getOrThrow<string>('APNS_KEY_P8')
      .replace(/\\n/g, '\n');
    const privateKey = await importPKCS8(p8, 'ES256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .sign(privateKey);
    this.cachedJwt = { token, iat: now };
    return token;
  }

  private post(
    host: string,
    deviceToken: string,
    jwt: string,
    payload: object,
    opts: { collapseId?: string; pushType?: string },
  ): Promise<ApnsResult> {
    return new Promise((resolve) => {
      const client = http2.connect(host);
      client.on('error', (e) => {
        this.logger.warn(`APNs connect error: ${e.message}`);
        resolve({ ok: false, status: 0, reason: 'connect-error' });
      });

      const headers: http2.OutgoingHttpHeaders = {
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': this.config.get<string>('APNS_BUNDLE_ID'),
        'apns-push-type': opts.pushType ?? 'alert',
      };
      if (opts.collapseId) headers['apns-collapse-id'] = opts.collapseId;

      const req = client.request(headers);
      let status = 0;
      let body = '';
      req.on('response', (h) => (status = Number(h[':status'])));
      req.setEncoding('utf8');
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        client.close();
        let reason: string | undefined;
        try {
          reason = body ? JSON.parse(body).reason : undefined;
        } catch {
          // ignore
        }
        resolve({ ok: status === 200, status, reason });
      });
      req.on('error', (e) => {
        client.close();
        this.logger.warn(`APNs request error: ${e.message}`);
        resolve({ ok: false, status: 0, reason: 'request-error' });
      });
      req.end(JSON.stringify(payload));
    });
  }
}
