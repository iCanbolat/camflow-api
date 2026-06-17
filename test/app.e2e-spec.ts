import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Full-stack e2e: spins up Postgres + Redis via testcontainers, runs migrations,
 * boots the app, and exercises auth → org → sync over HTTP. Requires Docker, so
 * it runs in CI (and locally with Docker), not in environments without it.
 */
jest.setTimeout(120_000);

describe('CamFlow API (e2e)', () => {
  let pg: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    const databaseUrl = pg.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.JWT_ACCESS_SECRET = 'e2e-secret-e2e-secret-e2e-secret-1234';
    process.env.STORAGE_DRIVER = 'local';
    process.env.CLEANUP_ENABLED = 'false';

    // Apply migrations.
    const pool = new Pool({ connectionString: databaseUrl });
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    await pool.end();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
    await redis?.stop();
  });

  const api = () => request(app.getHttpServer());

  it('health is green', async () => {
    await api().get('/health').expect(200);
  });

  it('rejects unauthenticated org listing', async () => {
    await api().get('/api/v1/organizations').expect(401);
  });

  it('signs up, creates an org, and round-trips a project via sync', async () => {
    const email = `e2e-${randomUUID()}@camflow.app`;
    const signUp = await api()
      .post('/api/v1/auth/sign-up')
      .send({ email, password: 'password123', displayName: 'E2E User' })
      .expect(201);
    const access: string = signUp.body.accessToken;
    expect(access).toBeTruthy();
    expect(signUp.body.refreshToken).toBeTruthy();

    const auth = { Authorization: `Bearer ${access}` };

    const org = await api()
      .post('/api/v1/organizations')
      .set(auth)
      .send({ name: 'E2E Co.' })
      .expect(201);
    const orgId: string = org.body.id;

    const projectId = randomUUID();
    const push = await api()
      .post('/api/v1/sync/push')
      .set(auth)
      .send({
        mutations: [
          {
            idempotencyKey: randomUUID(),
            entity: 'project',
            op: 'upsert',
            id: projectId,
            organizationId: orgId,
            updatedAt: new Date().toISOString(),
            payload: { name: 'Riverside' },
          },
        ],
      })
      .expect(200);
    expect(push.body.results[0].status).toBe('applied');

    const pull = await api()
      .get('/api/v1/sync/pull')
      .query({ organizationId: orgId, since: 0 })
      .set(auth)
      .expect(200);
    const projects = pull.body.changes.project ?? [];
    expect(projects.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const email = `e2e-${randomUUID()}@camflow.app`;
    const signUp = await api()
      .post('/api/v1/auth/sign-up')
      .send({ email, password: 'password123', displayName: 'Rotate User' })
      .expect(201);
    const firstRefresh: string = signUp.body.refreshToken;

    const refreshed = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(firstRefresh);

    // Replaying the now-rotated token is reuse → 401.
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(401);
  });
});
