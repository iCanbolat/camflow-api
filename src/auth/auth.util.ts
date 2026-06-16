import { Request } from 'express';

const COLOR_PALETTE = [
  '#FF6B35',
  '#1B98E0',
  '#13B5B1',
  '#6C63FF',
  '#E0475B',
  '#F7B32B',
  '#8D6E63',
  '#43A047',
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Deterministic avatar color so the same email always gets the same chip. */
export function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export interface RequestContext {
  userAgent?: string;
  ip?: string;
}

export function requestContext(req: Request): RequestContext {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 400),
    ip: req.ip,
  };
}

/** Parses a JWT TTL ('15m', '1h', '7d', or plain seconds) into seconds. */
export function parseDurationSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return value; // 's' or bare seconds
  }
}
