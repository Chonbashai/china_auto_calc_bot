import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalculationsModule } from '../calculations/calculations.module';
import { HistoryModule } from '../history/history.module';
import { AdminModule } from '../admin/admin.module';
import { HealthController } from './health.controller';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule, CalculationsModule, HistoryModule, AdminModule],
  controllers: [HealthController, TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
