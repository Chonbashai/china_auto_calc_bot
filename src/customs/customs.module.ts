import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaywrightModule } from '../common/playwright.module';
import { CalcusWidgetClient } from './calcus-widget.client';
import { CustomsService } from './customs.service';

@Module({
  imports: [ConfigModule, PlaywrightModule],
  providers: [CalcusWidgetClient, CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
