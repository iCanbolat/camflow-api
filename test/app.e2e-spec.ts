import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Smoke test. Requires Postgres + Redis (docker-compose up) to be running.
// Phase 5 replaces this with testcontainers-backed e2e coverage.
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) reports component status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect((res) => {
        // 200 when DB+Redis are up, 503 when a dependency is down.
        if (![200, 503].includes(res.status)) {
          throw new Error(`Unexpected status ${res.status}`);
        }
      });
  });

  it('rejects unauthenticated access to a protected route', () => {
    return request(app.getHttpServer()).get('/api/v1/organizations').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
