import {
  nameFromEmail,
  normalizeEmail,
  parseDurationSeconds,
  pickColor,
} from './auth.util';

describe('auth utils', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('derives a display name from an email local part', () => {
    expect(nameFromEmail('alice@camflow.app')).toBe('Alice');
  });

  it('picks a deterministic color per seed', () => {
    expect(pickColor('alice@camflow.app')).toBe(pickColor('alice@camflow.app'));
    expect(pickColor('a')).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('parses JWT TTL strings into seconds', () => {
    expect(parseDurationSeconds('15m')).toBe(900);
    expect(parseDurationSeconds('1h')).toBe(3600);
    expect(parseDurationSeconds('7d')).toBe(604800);
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('45')).toBe(45);
    expect(parseDurationSeconds('garbage')).toBe(900); // safe fallback
  });
});
