import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BANK_COMMISSION_RATE, FIXED_COSTS } from '../config/constants';
import { ValidationError } from '../common/errors';
import { CurrencyService } from '../currency/currency.service';
import { CustomsService } from '../customs/customs.service';
import { CalculationInputDto, CalculationResult } from './calculation.dto';

@Injectable()
export class CalculationsService {
  private readonly logger = new Logger(CalculationsService.name);

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly customsService: CustomsService,
  ) {}

  async calculate(input: CalculationInputDto): Promise<CalculationResult> {
    const dto = this.validateInput(input);

    const yuanRate = await this.currencyService.getYuanRate(dto.yuanRate);
    const invoice = dto.costYuan * yuanRate * (1 + BANK_COMMISSION_RATE);
    const costRubForCustoms = dto.costYuan * yuanRate;

    const customs = await this.customsService.calculateCustoms(
      {
        year: dto.year,
        engineVolume: dto.engineVolume,
        kw: dto.kw,
        costRub: costRubForCustoms,
        costYuan: dto.costYuan,
      },
      dto.customs,
    );

    const total =
      invoice +
      customs +
      FIXED_COSTS.commission +
      FIXED_COSTS.broker +
      FIXED_COSTS.lab +
      FIXED_COSTS.registration;

    const result: CalculationResult = {
      model: dto.model ?? null,
      year: dto.year,
      engineVolume: dto.engineVolume,
      kw: dto.kw,
      costYuan: dto.costYuan,
      yuanRate,
      invoice,
      customs,
      commission: FIXED_COSTS.commission,
      broker: FIXED_COSTS.broker,
      lab: FIXED_COSTS.lab,
      registration: FIXED_COSTS.registration,
      total,
    };

    this.logger.log(`Calculation completed: year=${dto.year}, total=${Math.round(total)}`);

    return result;
  }

  buildResultMessage(result: CalculationResult): string {
    const title = result.model
      ? `🚗 ${result.model} ${result.year}`
      : `🚗 Автомобиль ${result.year}`;

    return [
      title,
      '',
      `Себестоимость: ${this.formatYuan(result.costYuan)}`,
      `Курс ВТБ: ${result.yuanRate.toFixed(2)} ₽`,
      '',
      `1. Комиссия: ${this.formatRub(result.commission)}`,
      `2. Инвойс: ${this.formatRub(result.invoice)}`,
      `3. Таможня: ${this.formatRub(result.customs)}`,
      `4. Брокер: ${this.formatRub(result.broker)}`,
      `5. Лаба: ${this.formatRub(result.lab)}`,
      `6. Прописка: ${this.formatRub(result.registration)}`,
      '',
      '────────────────',
      '',
      `💰 ИТОГО ДО ЗБК:`,
      '',
      this.formatRub(result.total),
    ].join('\n');
  }

  private validateInput(input: CalculationInputDto): CalculationInputDto {
    const dto = plainToInstance(CalculationInputDto, input);
    const errors = validateSync(dto);

    if (errors.length > 0) {
      throw new ValidationError('Некорректные данные для расчета');
    }

    return dto;
  }

  private formatRub(value: number): string {
    return `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value))} ₽`;
  }

  private formatYuan(value: number): string {
    return `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value))} ¥`;
  }
}
