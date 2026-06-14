import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './constants';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get config(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  get port(): number {
    return this.config.port;
  }

  get botToken(): string {
    return this.config.botToken;
  }

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get webhookUrl(): string {
    return this.config.webhookUrl;
  }

  get adminIds(): number[] {
    return this.config.adminIds;
  }

  get isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  isAdmin(userId: number): boolean {
    return this.config.adminIds.includes(userId);
  }
}
