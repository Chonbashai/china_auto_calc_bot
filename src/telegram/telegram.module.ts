import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalculationsModule } from '../calculations/calculations.module';
import { HistoryModule } from '../history/history.module';
import { AdminModule } from '../admin/admin.module';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [ConfigModule, CalculationsModule, HistoryModule, AdminModule],
  providers: [TelegramService],
  controllers: [TelegramController],
})
export class TelegramModule {}
