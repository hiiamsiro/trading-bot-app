import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import pinoHttp from 'pino-http';
import express from 'express';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/cors';
import { AppLogger } from './common/logging/logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

const rootLogger = new AppLogger('system');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Structured HTTP request/response logging via pino-http
  app.use(
    pinoHttp({
      logger: rootLogger.logger,
      // pino-http expects a Logger that has .child() and level methods;
      // AppLogger exposes .logger internally, so we pass that directly.
      // Cast needed because pino-http types expect a full PinoLogger interface.
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: {
        ignore: (req) =>
          // Don't log health checks or swagger requests
          ['/health', '/api/docs', '/api-json'].some((p) =>
            (req as { url?: string }).url?.startsWith(p),
          ),
      },
      // Forward the trace ID if the client sent one
      customSuccessMessage: (req, res) =>
        `${(req as { method?: string }).method ?? 'REQ'} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${(req as { method?: string }).method ?? 'REQ'} errored: ${err?.message ?? res.statusCode}`,
      // Hide default pino-http success/error noise — our interceptor handles that
      quietReqLogger: true,
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  // Stripe webhook endpoint needs the raw (unparsed) request body to verify signatures.
  // Apply express.raw() specifically for /billing/webhook so it bypasses the JSON parser.
  app.use('/billing/webhook', express.raw({ type: 'application/json' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Every unhandled exception lands here — structured, no leaks to clients
  app.useGlobalFilters(new AllExceptionsFilter());

  // Log every HTTP request with correlation ID
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Trading Bot API')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the token from login or register',
    })
    .addTag('auth', 'Registration and login')
    .addTag('users', 'Authenticated user profile')
    .addTag('bots', 'Bot CRUD and execution logs')
    .addTag('trades', 'Read-only trade history')
    .addTag('market-data', 'Live and historical market candles')
    .addTag('dashboard', 'Aggregated metrics and activity')
    .addTag('logs', 'Cross-bot log querying and filters')
    .addTag('notifications', 'In-app notifications for key bot and trade events')
    .addTag('health', 'Service health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  rootLogger.info(`Application is running on: http://localhost:${port}`, {
    category: 'system',
  });
  rootLogger.info(`Swagger documentation: http://localhost:${port}/api`, {
    category: 'system',
  });
}

bootstrap().catch((err) => {
  rootLogger.fatal('Failed to start application', {
    errorName: err instanceof Error ? err.name : 'UnknownError',
    errorMessage: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
