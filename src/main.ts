import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/constants';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
    bodyParser: false,
  });

  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: number) => void;
    use: (handler: (req: Request, res: Response, next: NextFunction) => void) => void;
  };
  expressApp.set('trust proxy', 1);

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.method === 'POST' && req.path === '/telegram/webhook') {
      console.error(
        `[WEBHOOK-MW] ${new Date().toISOString()} ct=${req.headers['content-type'] ?? 'none'} body=${JSON.stringify(req.body ?? null)}`,
      );
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const config = configService.get<AppConfig>('app');
  if (!config) {
    throw new Error('Application configuration is not loaded');
  }
  validateRequiredConfig(config);

  const port = config.port;

  await app.listen(port, '0.0.0.0');
  logger.log(`Application started on port ${port}`);
  logger.log(`Routes: GET /health, POST /telegram/webhook`);
  logger.log(`Environment: ${config.nodeEnv === 'production' ? 'production' : 'development'}`);
}

function validateRequiredConfig(config: AppConfig): void {
  if (!config.botToken) {
    throw new Error('BOT_TOKEN is required');
  }

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!config.webhookUrl) {
    throw new Error('WEBHOOK_URL is required');
  }
}

void bootstrap();
