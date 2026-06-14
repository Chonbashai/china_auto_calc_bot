import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationHistory } from '../entities/calculation-history.entity';
import { HistoryService } from './history.service';

@Module({
  imports: [TypeOrmModule.forFeature([CalculationHistory])],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
