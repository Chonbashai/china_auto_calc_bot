import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YuanRate } from '../entities/yuan-rate.entity';
import { PlaywrightModule } from '../common/playwright.module';
import { CurrencyService } from './currency.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([YuanRate]), PlaywrightModule],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
