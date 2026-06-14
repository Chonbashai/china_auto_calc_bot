import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YuanRate } from '../entities/yuan-rate.entity';
import { CurrencyService } from './currency.service';

@Module({
  imports: [TypeOrmModule.forFeature([YuanRate])],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
