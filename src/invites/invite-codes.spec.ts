import { buildInviteLink, generateCode, normalizeCode } from './invite-codes';

describe('invite codes', () => {
  it('generates 8-char codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    }
  });

  it('normalizes valid input and rejects bad input', () => {
    expect(normalizeCode('  crew2345 ')).toBe('CREW2345');
    expect(normalizeCode('CREW2345')).toBe('CREW2345');
    expect(normalizeCode('SHORT')).toBeNull();
    expect(normalizeCode('CREW2340')).toBeNull(); // 0 not in alphabet
    expect(normalizeCode('CREW234I')).toBeNull(); // I not in alphabet
  });

  it('builds universal + custom-scheme links', () => {
    const link = buildInviteLink('CREW2345', 'camflow.app', 'camflow');
    expect(link.universalUrl).toBe('https://camflow.app/invite/CREW2345');
    expect(link.customSchemeUrl).toBe('camflow://invite/CREW2345');
  });
});
