import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';
import { ALL_QUEUES } from './queue.constants';

/**
 * Mounts the Bull Board dashboard at /admin/queues, protected by HTTP basic
 * auth (BULL_BOARD_USER / BULL_BOARD_PASSWORD). Mounted as raw Express so it
 * sits outside the global API prefix and Nest guards.
 */
export function mountBullBoard(app: INestApplication, config: ConfigService) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: ALL_QUEUES.map(
      (name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name))),
    ),
    serverAdapter,
  });

  const user = config.getOrThrow<string>('BULL_BOARD_USER');
  const pass = config.getOrThrow<string>('BULL_BOARD_PASSWORD');
  app.use('/admin/queues', basicAuth(user, pass), serverAdapter.getRouter());
}

function basicAuth(user: string, pass: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString();
      const idx = decoded.indexOf(':');
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="CamFlow Queues"');
    res.status(401).send('Authentication required.');
  };
}
