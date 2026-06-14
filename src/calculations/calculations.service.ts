import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppConfig, FIXED_COSTS } from '../config/constants';
import { ValidationError } from '../common/errors';
import { CurrencyService } from '../currency/currency.service';
import { CustomsService } from '../customs/customs.service';
import { CalculationInputDto, CalculationResult } from './calculation.dto';
import { formatReleaseDate } from '../utils/vehicle-age';

@Injectable()
export class CalculationsService {
  private readonly logger = new Logger(CalculationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly currencyService: CurrencyService,
    private readonly customsService: CustomsService,
  ) {}

  private get appConfig(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  async calculate(input: CalculationInputDto): Promise<CalculationResult> {
    const dto = this.validateInput(input);
    const bankCommissionRate = dto.bankCommissionRate ?? this.appConfig.defaultBankCommissionRate;

    const yuanQuote = await this.currencyService.getYuanRate(dto.yuanRate);
    const invoice = dto.costYuan * yuanQuote.rate * (1 + bankCommissionRate);
    const costRubForCustoms = dto.costYuan * yuanQuote.rate;

    const customsResult = await this.customsService.calculateCustoms(
      {
        month: dto.month,
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
      customsResult.total +
      FIXED_COSTS.commission +
      FIXED_COSTS.broker +
      FIXED_COSTS.lab +
      FIXED_COSTS.registration;

    const result: CalculationResult = {
      model: dto.model ?? null,
      month: dto.month,
      year: dto.year,
      releaseDateLabel: formatReleaseDate(dto.month, dto.year),
      vehicleAgeLabel: customsResult.ageLabel,
      calcusAgeLabel: customsResult.calcusAgeLabel,
      isPreferentialUtil: customsResult.isPreferentialUtil,
      utilStatusLabel: customsResult.utilStatusLabel,
      engineVolume: dto.engineVolume,
      kw: dto.kw,
      costYuan: dto.costYuan,
      yuanRate: yuanQuote.rate,
      yuanRateSourceLabel: yuanQuote.sourceLabel,
      bankCommissionRate,
      bankCommissionLabel: `${(bankCommissionRate * 100).toFixed(2).replace(/\.?0+$/, '')}%`,
      invoice,
      customs: customsResult.total,
      customsSourceLabel:
        customsResult.source === 'calcus-api'
          ? 'Calcus API'
          : customsResult.source === 'calcus-scrape'
            ? 'Calcus (сайт)'
            : 'вручную',
      commission: FIXED_COSTS.commission,
      broker: FIXED_COSTS.broker,
      lab: FIXED_COSTS.lab,
      registration: FIXED_COSTS.registration,
      total,
    };

    this.logger.log(
      `Calculation completed: ${result.releaseDateLabel}, util=${result.utilStatusLabel}, total=${Math.round(total)}`,
    );

    return result;
  }

  buildResultMessage(result: CalculationResult): string {
    const title = result.model
      ? `🚗 ${result.model} (${result.releaseDateLabel})`
      : `🚗 Автомобиль (${result.releaseDateLabel})`;

    return [
      title,
      '',
      `Возраст: ${result.vehicleAgeLabel} (${result.calcusAgeLabel})`,
      `Утильсбор: ${result.utilStatusLabel}`,
      '',
      `Себестоимость: ${this.formatYuan(result.costYuan)}`,
      `Курс: ${result.yuanRate.toFixed(2)} ₽ (${result.yuanRateSourceLabel})`,
      `Комиссия банка: ${result.bankCommissionLabel}`,
      '',
      `1. Комиссия: ${this.formatRub(result.commission)}`,
      `2. Инвойс: ${this.formatRub(result.invoice)}`,
      `3. Таможня: ${this.formatRub(result.customs)} (${result.customsSourceLabel})`,
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
