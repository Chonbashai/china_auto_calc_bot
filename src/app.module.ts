import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './config/config.module';
import { AppConfig } from './config/constants';
import { PlaywrightModule } from './common/playwright.module';
import { YuanRate } from './entities/yuan-rate.entity';
import { CalculationHistory } from './entities/calculation-history.entity';
import { TelegramModule } from './telegram/telegram.module';
import { CurrencyModule } from './currency/currency.module';
import { CustomsModule } from './customs/customs.module';
import { CalculationsModule } from './calculations/calculations.module';
import { HistoryModule } from './history/history.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    AppConfigModule,
    PlaywrightModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<AppConfig>('app');
        if (!config) {
          throw new Error('Application configuration is not loaded');
        }
        return {
          type: 'postgres',
          url: config.databaseUrl,
          entities: [YuanRate, CalculationHistory],
          synchronize: true,
          logging: false,
          ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    CurrencyModule,
    CustomsModule,
    CalculationsModule,
    HistoryModule,
    AdminModule,
    TelegramModule,
  ],
})
export class AppModule {}
