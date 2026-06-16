import { z } from 'zod';

/**
 * Single source of truth for environment configuration. The schema runs at
 * boot (via `ConfigModule.forRoot({ validate })`) so the process fails fast
 * with a readable error instead of crashing later on a missing/invalid var.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('*'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(60),

  APPLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),

  INVITE_WEB_HOST: z.string().default('camflow.app'),
  INVITE_SCHEME: z.string().default('camflow'),

  BULL_BOARD_USER: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('change-me'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
