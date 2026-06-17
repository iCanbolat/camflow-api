import { z } from 'zod';

/**
 * Single source of truth for environment configuration. The schema runs at
 * boot (via `ConfigModule.forRoot({ validate })`) so the process fails fast
 * with a readable error instead of crashing later on a missing/invalid var.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGINS: z.string().default('*'),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(60),

    APPLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),

    INVITE_WEB_HOST: z.string().default('camflow.app'),
    INVITE_SCHEME: z.string().default('camflow'),

    BULL_BOARD_USER: z.string().default('admin'),
    BULL_BOARD_PASSWORD: z.string().default('change-me'),

    // --- Media storage (Phase 3) ---
    // Public base URL of this API, used to build the upload-proxy URL.
    API_PUBLIC_URL: z.string().url().optional(),
    STORAGE_DRIVER: z.enum(['local', 'bunny']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    BUNNY_STORAGE_ZONE: z.string().optional(),
    BUNNY_STORAGE_HOST: z.string().default('storage.bunnycdn.com'),
    BUNNY_STORAGE_PASSWORD: z.string().optional(),
    BUNNY_PULL_ZONE_HOST: z.string().optional(),
    BUNNY_PULL_ZONE_TOKEN: z.string().optional(),

    // --- APNs push (Phase 4). All optional; push is a no-op until configured. ---
    APNS_KEY_P8: z.string().optional(), // .p8 contents (\n-escaped is fine)
    APNS_KEY_ID: z.string().optional(),
    APNS_TEAM_ID: z.string().optional(),
    APNS_BUNDLE_ID: z.string().optional(), // app topic, e.g. com.camflow
    APNS_PRODUCTION: z.enum(['true', 'false']).default('false'),

    // --- Ops / retention (Phase 5) ---
    SWAGGER_ENABLED: z.enum(['true', 'false']).optional(), // force docs in prod
    CLEANUP_ENABLED: z.enum(['true', 'false']).default('true'),
    // Hard-delete soft-deleted rows older than this (must exceed device purge).
    TOMBSTONE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
    // Drop expired/revoked refresh tokens older than this.
    REFRESH_TOKEN_GRACE_DAYS: z.coerce.number().int().positive().default(7),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'bunny') {
      for (const key of [
        'BUNNY_STORAGE_ZONE',
        'BUNNY_STORAGE_PASSWORD',
        'BUNNY_PULL_ZONE_HOST',
        'BUNNY_PULL_ZONE_TOKEN',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=bunny`,
          });
        }
      }
    }
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
