import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaywrightModule } from '../common/playwright.module';
import { CustomsService } from './customs.service';

@Module({
  imports: [ConfigModule, PlaywrightModule],
  providers: [CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
