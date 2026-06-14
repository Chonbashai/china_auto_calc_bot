import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationHistory } from '../entities/calculation-history.entity';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([CalculationHistory])],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
