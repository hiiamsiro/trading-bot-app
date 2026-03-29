/**
 * RequestLoggingInterceptor
 *
 * Attaches a UUID correlation ID to every request and logs:
 *   - request method, path, query params, user-agent
 *   - latency and HTTP status on response
 *   - authenticated userId (if a JWT was present)
 *   - botId (if inferred from the route params)
 *
 * The correlation ID is written to the response `X-Trace-Id` header so
 * clients can include it in follow-up requests or bug reports.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { AppLogger } from '../logging/logger.service';

const REQUEST_LOGGER = new AppLogger('http');

// Request-scoped provider injection via static factory
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
    const startMs = Date.now();

    // Stamp response with the trace ID
    res.setHeader('X-Trace-Id', traceId);

    // Attach to request so downstream services can read it
    (req as Request & { traceId: string }).traceId = traceId;

    // Determine user (set by auth guard — guard runs before interceptor)
    const userId: string | undefined = (req.user as { sub?: string } | undefined)?.sub;

    return next.handle().pipe(
      tap({
        next: () => {
          REQUEST_LOGGER.info(
            `${req.method} ${req.route?.path ?? req.url} completed`,
            {
              traceId,
              userId,
              latencyMs: Date.now() - startMs,
              statusCode: res.statusCode,
              method: req.method,
              path: req.route?.path ?? req.url,
              query: Object.keys(req.query).length > 0 ? req.query : undefined,
              userAgent: req.headers['user-agent'],
            },
          );
        },
        error: (err: Error) => {
          REQUEST_LOGGER.error(
            `${req.method} ${req.route?.path ?? req.url} failed`,
            {
              traceId,
              userId,
              latencyMs: Date.now() - startMs,
              method: req.method,
              path: req.route?.path ?? req.url,
              errorName: err.name,
              errorMessage: err.message,
            },
          );
        },
      }),
    );
  }
}
