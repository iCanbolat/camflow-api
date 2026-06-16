import { RedisOptions } from 'ioredis';

/**
 * Parses a `redis://[user:pass@]host:port[/db]` URL into ioredis options.
 * BullMQ requires `maxRetriesPerRequest: null` on its connection, so we expose
 * the parsed options (rather than passing the raw URL) to share one config.
 */
export function redisOptions(url: string): RedisOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
  };
}
