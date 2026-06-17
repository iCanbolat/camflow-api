import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { RedisService } from './redis/redis.service';
import { AuthModule } from './auth/auth.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { validateEnv } from './common/config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InvitesModule } from './invites/invites.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PushModule } from './push/push.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    // Default rate limit (Redis-backed so it holds across instances); auth
    // routes tighten it with @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedisService(redis.client),
      }),
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    StorageModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    InvitesModule,
    NotificationsModule,
    SyncModule,
    MediaModule,
    RealtimeModule,
    PushModule,
    CleanupModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
