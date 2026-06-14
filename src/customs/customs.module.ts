import { Module } from '@nestjs/common';
import { CustomsService } from './customs.service';

@Module({
  providers: [CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
