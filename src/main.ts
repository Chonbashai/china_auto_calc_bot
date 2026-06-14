import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/constants';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: number) => void;
  };
  expressApp.set('trust proxy', 1);

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
