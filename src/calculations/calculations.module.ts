import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyModule } from '../currency/currency.module';
import { CustomsModule } from '../customs/customs.module';
import { CalculationsService } from './calculations.service';

@Module({
  imports: [ConfigModule, CurrencyModule, CustomsModule],
  providers: [CalculationsService],
  exports: [CalculationsService],
})
export class CalculationsModule {}
