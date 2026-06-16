import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Translates every thrown error into a consistent JSON envelope:
 * `{ statusCode, error, message, code?, path, timestamp, ...details }`.
 * 5xx errors are logged with their stack; 4xx are passed through quietly.
 * Domain handlers throw `HttpException` with an object payload carrying a
 * machine-readable `code` (e.g. `codeNotFound`) plus any extra fields the
 * client needs (e.g. `organizationId` on `alreadyMember`).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const { message: m, statusCode, error, ...rest } = res as Record<
          string,
          unknown
        >;
        message = (m as string | string[]) ?? exception.message;
        extra = rest;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      ...extra,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
