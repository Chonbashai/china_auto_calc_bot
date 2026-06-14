import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Page } from 'playwright';
import { CalculateCustomsDto } from '../calculations/calculation.dto';
import {
  AppConfig,
  CALCUS_API_URL,
  CALCUS_CUSTOMS_URL,
  CustomsCalculationResult,
  RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
} from '../config/constants';
import { ManualInputRequiredError } from '../common/errors';
import { PlaywrightService } from '../common/playwright.service';
import { parseAmountFromText, withRetry } from '../utils/helpers';
import { buildVehicleAgeInfo } from '../utils/vehicle-age';
import { CalcusWidgetClient } from './calcus-widget.client';

interface CalcusApiResponse {
  sbor?: number;
  tax?: number;
  util?: number;
  nds?: number;
  excise?: number;
  total?: number;
  total2?: number;
}

const CUSTOMS_FEE_LABELS = [
  'Таможенный сбор',
  'Таможенная пошлина',
  'Акциз',
  'НДС',
  'Утилизационный сбор',
] as const;

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly calcusWidgetClient: CalcusWidgetClient,
    private readonly playwrightService: PlaywrightService,
  ) {}

  private get appConfig(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  async calculateCustoms(
    dto: CalculateCustomsDto,
    manualCustoms?: number,
  ): Promise<CustomsCalculationResult> {
    const ageInfo = buildVehicleAgeInfo(dto.month, dto.year, dto.kw, dto.engineVolume);

    if (manualCustoms !== undefined) {
      return this.buildResult(manualCustoms, ageInfo, 'manual');
    }

    try {
      const total = await withRetry(
        () =>
          this.calcusWidgetClient.calculate({
            age: ageInfo.calcusAgeCode,
            engineVolume: dto.engineVolume,
            kw: dto.kw,
            costYuan: dto.costYuan,
          }),
        RETRY_ATTEMPTS,
        RETRY_BASE_DELAY_MS,
        (error, attempt) => {
          this.logger.warn(`Calcus widget attempt ${attempt} failed: ${String(error)}`);
        },
      );

      this.logger.log(`Calcus widget customs calculated: ${total}`);
      return this.buildResult(total, ageInfo, 'calcus-widget');
    } catch (widgetError) {
      this.logger.error(`Calcus widget failed: ${String(widgetError)}`);
    }

    if (this.appConfig.calcusApiKey) {
      try {
        const total = await withRetry(
          () => this.fetchViaCalcusApi(dto, ageInfo.calcusAgeCode),
          RETRY_ATTEMPTS,
          RETRY_BASE_DELAY_MS,
          (error, attempt) => {
            this.logger.warn(`Calcus API attempt ${attempt} failed: ${String(error)}`);
          },
        );

        this.logger.log(`Calcus API customs calculated: ${total}`);
        return this.buildResult(total, ageInfo, 'calcus-api');
      } catch (error) {
        this.logger.error(`Calcus API failed: ${String(error)}`);
      }
    }

    try {
      const total = await withRetry(
        () => this.scrapeCustoms(dto, ageInfo.calcusAgeLabel),
        RETRY_ATTEMPTS,
        RETRY_BASE_DELAY_MS,
        (error, attempt) => {
          this.logger.warn(`Calcus scrape attempt ${attempt} failed: ${String(error)}`);
        },
      );

      this.logger.log(`Calcus customs scraped: ${total}`);
      return this.buildResult(total, ageInfo, 'calcus-scrape');
    } catch (error) {
      this.logger.error(`Calcus customs calculation failed: ${String(error)}`);
      throw new ManualInputRequiredError(
        'Не удалось рассчитать таможню через Calcus. Введите сумму таможни вручную (₽).',
        'customs',
      );
    }
  }

  private buildResult(
    total: number,
    ageInfo: ReturnType<typeof buildVehicleAgeInfo>,
    source: CustomsCalculationResult['source'],
  ): CustomsCalculationResult {
    return {
      total: Math.round(total),
      isPreferentialUtil: ageInfo.isPreferentialUtil,
      utilStatusLabel: ageInfo.utilStatusLabel,
      ageLabel: ageInfo.ageLabel,
      calcusAgeLabel: ageInfo.calcusAgeLabel,
      source,
    };
  }

  private async fetchViaCalcusApi(
    dto: CalculateCustomsDto,
    ageCode: ReturnType<typeof buildVehicleAgeInfo>['calcusAgeCode'],
  ): Promise<number> {
    const payload = {
      owner: 1,
      age: ageCode,
      engine: 1,
      power: dto.kw,
      power_unit: 2,
      value: dto.engineVolume,
      price: Math.round(dto.costYuan),
      curr: 'CNY',
      year: new Date().getFullYear(),
    };

    const response = await axios.post<CalcusApiResponse>(CALCUS_API_URL, payload, {
      timeout: 20_000,
      headers: {
        'Content-Type': 'application/json',
        clientkey: this.appConfig.calcusApiKey,
      },
      validateStatus: (status) => status >= 200 && status < 500,
    });

    if (response.status >= 400) {
      throw new Error(`Calcus API HTTP ${response.status}`);
    }

    const total = response.data.total2 ?? response.data.total;
    if (total === undefined || total <= 0) {
      throw new Error('Calcus API returned empty total');
    }

    return Math.round(total);
  }

  private async scrapeCustoms(
    dto: CalculateCustomsDto,
    calcusAgeLabel: ReturnType<typeof buildVehicleAgeInfo>['calcusAgeLabel'],
  ): Promise<number> {
    return this.playwrightService.withPage(async (page) => {
      await page.goto(CALCUS_CUSTOMS_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await this.dismissCookieBanner(page);

      await page.locator('select[name="owner"]').selectOption({ index: 0 });
      await page.locator('select[name="age"]').selectOption({ label: calcusAgeLabel });
      await page.locator('select[name="engine"]').selectOption({ label: 'Бензиновый' });
      await page.locator('select[name="power_unit"]').selectOption({ label: 'кВт' });
      await page.locator('input[name="value"]').fill(String(dto.engineVolume));
      await page.locator('input[name="power"]').fill(String(dto.kw));
      await page.locator('select[name="curr"]').selectOption({ label: 'Китайский юань' });
      await page.locator('input[name="price"]').fill(String(Math.round(dto.costYuan)));

      await this.submitCalculation(page);

      const customs = await this.extractCustomsTotal(page);
      if (customs === null || customs <= 0) {
        throw new Error('Unable to extract customs amount from Calcus page');
      }

      return Math.round(customs);
    });
  }

  private async dismissCookieBanner(page: Page): Promise<void> {
    const acceptButton = page.getByRole('button', { name: /я согласен/i });
    if ((await acceptButton.count()) > 0) {
      await acceptButton.first().click();
      await page.waitForTimeout(500);
    }
  }

  private async submitCalculation(page: Page): Promise<void> {
    const submitButton = page.locator('input.calc-submit[type="submit"]').first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
    } else {
      await page.getByRole('button', { name: /рассчитать/i }).first().click();
    }

    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return (
          /Полная стоимость растаможки/i.test(text) ||
          /Утилизационный сбор/i.test(text)
        );
      },
      undefined,
      { timeout: 30_000 },
    );

    await page.waitForTimeout(1_000);
  }

  private async extractCustomsTotal(page: Page): Promise<number | null> {
    const bodyText = await page.locator('body').innerText();

    const fullTotal = this.extractLabelAmount(bodyText, 'Полная стоимость растаможки');
    if (fullTotal !== null && fullTotal > 0) {
      return fullTotal;
    }

    let total = 0;
    let foundAny = false;

    for (const label of CUSTOMS_FEE_LABELS) {
      const amount = this.extractLabelAmount(bodyText, label);
      if (amount !== null) {
        total += amount;
        foundAny = true;
      }
    }

    if (foundAny) {
      return total;
    }

    const labeledMatch = bodyText.match(/(?:таможн|растамож|пошлин)[^\d]{0,60}(\d[\d\s]{2,})/iu);
    if (labeledMatch) {
      return parseAmountFromText(labeledMatch[1]);
    }

    return null;
  }

  private extractLabelAmount(bodyText: string, label: string): number | null {
    const patterns = [
      new RegExp(`${label}[^\\d]{0,30}([\\d\\s]+)\\s*₽`, 'i'),
      new RegExp(`${label}[^\\d]{0,40}(\\d[\\d\\s]+)`, 'i'),
    ];

    for (const regex of patterns) {
      const match = bodyText.match(regex);
      if (match) {
        const amount = parseAmountFromText(match[1]);
        if (amount !== null) {
          return amount;
        }
      }
    }

    return null;
  }
}
