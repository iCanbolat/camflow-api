import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { mountBullBoard } from './queue/bull-board';

// The media upload route streams raw binary; everything else parses JSON/form.
const RAW_BODY_PATHS = ['/api/v1/media/upload'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  // Route Nest logs through pino.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Behind a proxy/load balancer: trust X-Forwarded-* so req.ip (used for
  // rate limiting and refresh-token auditing) reflects the real client.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());

  // Body parsing for all routes except the raw streaming upload.
  const jsonParser = json({ limit: '2mb' });
  const formParser = urlencoded({ extended: true, limit: '2mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (RAW_BODY_PATHS.some((p) => req.path.startsWith(p))) return next();
    jsonParser(req, res, (err) =>
      err ? next(err) : formParser(req, res, next),
    );
  });

  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');
  app.enableCors({
    origin:
      corsOrigins === '*' ? true : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Versioned prefix for the API; /health stays unprefixed for probes.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // OpenAPI docs at /docs (disabled in production unless SWAGGER_ENABLED=true).
  if (
    config.get('NODE_ENV') !== 'production' ||
    config.get('SWAGGER_ENABLED') === 'true'
  ) {
    const docConfig = new DocumentBuilder()
      .setTitle('CamFlow API')
      .setDescription('Backend for the CamFlow iOS app.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  mountBullBoard(app, config);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
