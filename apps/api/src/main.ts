import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { Request, Response, NextFunction, json, urlencoded } from 'express';
import { winstonConfig } from './common/logger/winston.config';
import { getBogotaTimezone } from './common/utils/timezone.util';

function parseCorsOrigins(): string[] {
  return [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
  ]
    .filter((value): value is string => !!value)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCorsOriginGuard() {
  const configuredOrigins = parseCorsOrigins();
  const allowAnyOrigin =
    configuredOrigins.includes('*') && process.env.NODE_ENV !== 'production';
  const allowedOrigins = new Set(
    configuredOrigins.filter((origin) => origin !== '*'),
  );
  const allowLocalhost = process.env.NODE_ENV !== 'production';
  const localhostPattern =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      allowAnyOrigin ||
      allowedOrigins.has(origin) ||
      (allowLocalhost && localhostPattern.test(origin))
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`), false);
  };
}

async function bootstrap() {
  // Keep server runtime deterministic; business timezone conversions are explicit.
  process.env.TZ = process.env.TZ || 'UTC';
  process.env.APP_TIMEZONE = process.env.APP_TIMEZONE || getBogotaTimezone();

  const app = await NestFactory.create(AppModule, {
    logger: winstonConfig,
  });

  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  const logger = new Logger('HTTP');

  // Structured Logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      logger.log(
        `${method} ${url} ${statusCode} - ${userAgent} ${ip} +${duration}ms`,
      );
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  const allowedCorsHeaders = [
    'Content-Type',
    'Accept',
    'Authorization',
    'x-enterprise-id',
    'x-test-role',
  ];
  app.enableCors({
    origin: buildCorsOriginGuard(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: allowedCorsHeaders.join(', '),
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
