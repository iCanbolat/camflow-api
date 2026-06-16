import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { mountBullBoard } from './queue/bull-board';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest logs through pino.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');
  app.enableCors({
    origin:
      corsOrigins === '*'
        ? true
        : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Versioned prefix for the API; /health stays unprefixed for probes.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.enableShutdownHooks();

  mountBullBoard(app, config);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
