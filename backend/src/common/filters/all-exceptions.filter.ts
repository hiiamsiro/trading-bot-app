/**
 * AllExceptionsFilter
 *
 * Catches every unhandled exception thrown anywhere in the application.
 * It:
 *   1. Logs the error with full structured context (trace ID, user, stack)
 *   2. Strips implementation details before sending a response to the client
 *   3. Always returns a consistent `{ statusCode, message, traceId }` shape
 *
 * HTTP status mapping:
 *   - HttpException / BadRequestException / UnauthorizedException → existing status
 *   - Record not found → 404
 *   - Prisma "not found" → 404
 *   - Validation errors (class-validator) → 400
 *   - All other errors → 500
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AppLogger } from '../logging/logger.service';

const EXCEPTION_LOGGER = new AppLogger('system');

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { traceId?: string }>();

    const traceId = req.traceId ?? 'unknown';
    const userId: string | undefined = (req.user as { sub?: string } | undefined)?.sub;
    const method = req.method;
    const path = req.route?.path ?? req.url;

    const { statusCode, clientMessage, logData } = this.buildErrorResponse(exception);

    EXCEPTION_LOGGER.error('Unhandled exception', {
      traceId,
      userId,
      category: 'system',
      method,
      path,
      ...logData,
    });

    res.status(statusCode).json({
      statusCode,
      message: clientMessage,
      traceId,
    });
  }

  private buildErrorResponse(exception: unknown): {
    statusCode: number;
    clientMessage: string;
    logData: Record<string, unknown>;
  } {
    // NestJS HTTP exceptions carry their own status
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      const message =
        typeof body === 'string'
          ? body
          : (body as Record<string, unknown>).message as string;

      return {
        statusCode: status,
        clientMessage: Array.isArray(message) ? message[0] : message ?? exception.name,
        logData: {
          errorName: exception.name,
          errorMessage: exception.message,
          httpStatus: status,
          responseBody: body,
        },
      };
    }

    // Prisma "not found" — thrown as plain Error with this message
    if (
      exception instanceof Error &&
      exception.message.includes('Record to update not found')
    ) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        clientMessage: 'Resource not found',
        logData: {
          errorName: exception.name,
          errorMessage: exception.message,
          httpStatus: HttpStatus.NOT_FOUND,
        },
      };
    }

    // Unknown error — treat as internal server error
    const error = exception instanceof Error ? exception : new Error(String(exception));

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      clientMessage: 'An unexpected error occurred',
      logData: {
        errorName: error.name || 'UnknownError',
        errorMessage: error.message,
        stack: error.stack,
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    };
  }
}
