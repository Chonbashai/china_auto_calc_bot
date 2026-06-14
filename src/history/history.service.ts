import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalculationHistory } from '../entities/calculation-history.entity';
import { CalculationResult } from '../calculations/calculation.dto';
import { formatDate, formatRub, formatYuan } from '../utils/helpers';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(CalculationHistory)
    private readonly historyRepository: Repository<CalculationHistory>,
  ) {}

  async saveCalculation(
    telegramUserId: number,
    username: string | undefined,
    result: CalculationResult,
  ): Promise<CalculationHistory> {
    const entity = this.historyRepository.create({
      telegramUserId: String(telegramUserId),
      username: username ?? null,
      model: result.model,
      year: result.year,
      engineVolume: result.engineVolume,
      kw: result.kw,
      costYuan: result.costYuan,
      yuanRate: result.yuanRate,
      customs: result.customs,
      invoice: result.invoice,
      total: result.total,
    });

    return this.historyRepository.save(entity);
  }

  async getUserHistory(telegramUserId: number, limit = 10): Promise<CalculationHistory[]> {
    return this.historyRepository.find({
      where: { telegramUserId: String(telegramUserId) },
      order: { calculatedAt: 'DESC' },
      take: limit,
    });
  }

  formatHistoryMessage(records: CalculationHistory[]): string {
    if (records.length === 0) {
      return 'История расчетов пуста. Нажмите «Рассчитать стоимость», чтобы сделать первый расчет.';
    }

    const lines = records.map((record, index) => {
      const title = record.model ? `${record.model} ${record.year}` : `Автомобиль ${record.year}`;

      return [
        `${index + 1}. ${title}`,
        `   ${formatDate(record.calculatedAt)}`,
        `   ${formatYuan(Number(record.costYuan))} → ${formatRub(Number(record.total))}`,
      ].join('\n');
    });

    return ['📋 Последние расчеты:', '', ...lines].join('\n');
  }
}
