import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalculationHistory } from '../entities/calculation-history.entity';

export interface AdminStats {
  usersCount: number;
  calculationsCount: number;
  calculationsToday: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(CalculationHistory)
    private readonly historyRepository: Repository<CalculationHistory>,
  ) {}

  async getStats(): Promise<AdminStats> {
    const calculationsCount = await this.historyRepository.count();

    const usersResult = await this.historyRepository
      .createQueryBuilder('history')
      .select('COUNT(DISTINCT history.telegramUserId)', 'count')
      .getRawOne<{ count: string }>();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const calculationsToday = await this.historyRepository
      .createQueryBuilder('history')
      .where('history.calculatedAt >= :startOfDay', { startOfDay })
      .getCount();

    return {
      usersCount: Number.parseInt(usersResult?.count ?? '0', 10),
      calculationsCount,
      calculationsToday,
    };
  }

  formatStatsMessage(stats: AdminStats): string {
    return [
      '📊 Статистика бота',
      '',
      `👥 Пользователей: ${stats.usersCount}`,
      `🧮 Всего расчетов: ${stats.calculationsCount}`,
      `📅 Расчетов сегодня: ${stats.calculationsToday}`,
    ].join('\n');
  }
}
