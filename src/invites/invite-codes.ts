import { randomInt } from 'crypto';

/** Unambiguous alphabet (no 0/O, 1/I/L), matching iOS `InviteLinks`. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Trims, uppercases and validates manual input against the code format. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return code;
}

export interface InviteLink {
  code: string;
  universalUrl: string;
  customSchemeUrl: string;
}

export function buildInviteLink(
  code: string,
  webHost: string,
  scheme: string,
): InviteLink {
  return {
    code,
    universalUrl: `https://${webHost}/invite/${code}`,
    customSchemeUrl: `${scheme}://invite/${code}`,
  };
}
