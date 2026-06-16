import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/** Injection token for the Drizzle client. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Fully-typed Drizzle database, aware of the whole schema. */
export type Database = NodePgDatabase<typeof schema>;

/** Owns the pg connection pool and exposes the Drizzle client. */
@Injectable()
class DrizzleConnection implements OnModuleDestroy {
  readonly pool: Pool;
  readonly db: Database;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 10,
    });
    this.db = drizzle(this.pool, { schema, casing: 'snake_case' });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    DrizzleConnection,
    {
      provide: DRIZZLE,
      inject: [DrizzleConnection],
      useFactory: (conn: DrizzleConnection) => conn.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
