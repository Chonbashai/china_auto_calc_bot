import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YuanRate } from '../entities/yuan-rate.entity';
import {
  AppConfig,
  CBR_DAILY_JSON_URL,
  RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  VTB_YUAN_URL,
  YuanRateQuote,
  YuanRateSource,
} from '../config/constants';
import { ManualInputRequiredError } from '../common/errors';
import { PlaywrightService } from '../common/playwright.service';
import { decimalToNumber, withRetry } from '../utils/helpers';

const SOURCE_LABELS: Record<YuanRateSource, string> = {
  vtb: 'ВТБ (продажа юаня)',
  cbr: 'ЦБ РФ (ориентир, не ВТБ)',
  cache: 'кэш (последний успешный курс)',
  manual: 'вручную',
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(YuanRate)
    private readonly yuanRateRepository: Repository<YuanRate>,
    private readonly playwrightService: PlaywrightService,
  ) {}

  private get appConfig(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  async getYuanRate(manualRate?: number): Promise<YuanRateQuote> {
    if (manualRate !== undefined) {
      await this.saveRate(manualRate, 'manual');
      return this.buildQuote(manualRate, 'manual');
    }

    try {
      const rate = await withRetry(
        () => this.fetchRateFromVtb(),
        RETRY_ATTEMPTS,
        RETRY_BASE_DELAY_MS,
        (error, attempt) => {
          this.logger.warn(`VTB rate fetch attempt ${attempt} failed: ${String(error)}`);
        },
      );

      await this.saveRate(rate, 'vtb');
      this.logger.log(`VTB yuan sell rate fetched: ${rate}`);
      return this.buildQuote(rate, 'vtb');
    } catch (error) {
      this.logger.error(`VTB rate fetch failed after retries: ${String(error)}`);
    }

    if (this.appConfig.cbrFallbackEnabled) {
      try {
        const cbrRate = await this.fetchCbrYuanRate();
        await this.saveRate(cbrRate, 'cbr');
        this.logger.warn(`Using CBR yuan rate as fallback: ${cbrRate}`);
        return this.buildQuote(cbrRate, 'cbr');
      } catch (error) {
        this.logger.error(`CBR rate fetch failed: ${String(error)}`);
      }
    }

    const cached = await this.getLatestRate();
    if (cached !== null) {
      this.logger.warn(`Using cached yuan rate: ${cached}`);
      return this.buildQuote(cached, 'cache');
    }

    throw new ManualInputRequiredError(
      'Не удалось получить курс юаня ВТБ. Введите курс продажи юаня ВТБ вручную (₽ за 1 ¥).',
      'yuanRate',
    );
  }

  private buildQuote(rate: number, source: YuanRateSource): YuanRateQuote {
    return {
      rate,
      source,
      sourceLabel: SOURCE_LABELS[source],
    };
  }

  private async fetchRateFromVtb(): Promise<number> {
    try {
      return await this.fetchRateViaAxios();
    } catch (axiosError) {
      this.logger.warn(`VTB axios fetch failed, trying Playwright: ${String(axiosError)}`);
      return this.playwrightService.fetchVtbYuanSellRate();
    }
  }

  private async fetchRateViaAxios(): Promise<number> {
    const response = await axios.get<string>(VTB_YUAN_URL, {
      timeout: 15_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const rate = this.parseSellRateFromHtml(response.data);
    if (rate === null) {
      throw new Error('Unable to parse VTB yuan sell rate from HTML');
    }

    return rate;
  }

  private parseSellRateFromHtml(html: string): number | null {
    const $ = cheerio.load(html);
    const bodyText = $('body').text().replace(/\u00a0/g, ' ');

    const sellPatterns = [
      /продаж[аи][^\d]{0,40}(\d{1,2}[.,]\d{2,4})/giu,
      /банк\s+прода[её]т[^\d]{0,40}(\d{1,2}[.,]\d{2,4})/giu,
      /sell[^\d]{0,40}(\d{1,2}[.,]\d{2,4})/giu,
    ];

    for (const pattern of sellPatterns) {
      const match = pattern.exec(bodyText);
      if (match) {
        const value = Number.parseFloat(match[1].replace(',', '.'));
        if (this.isValidYuanRate(value)) {
          return value;
        }
      }
    }

    return this.parseFirstCnyRateFromHtml($);
  }

  private parseFirstCnyRateFromHtml($: cheerio.CheerioAPI): number | null {
    const candidates: number[] = [];

    $('body')
      .find('*')
      .each((_, element) => {
        const text = $(element)
          .text()
          .replace(/\u00a0/g, ' ')
          .trim();
        if (!/юан/i.test(text) && !/cny/i.test(text) && !/¥/i.test(text)) {
          return;
        }

        const matches = text.match(/(\d{1,2}[.,]\d{2,4})/g);
        if (!matches) {
          return;
        }

        for (const match of matches) {
          const value = Number.parseFloat(match.replace(',', '.'));
          if (this.isValidYuanRate(value)) {
            candidates.push(value);
          }
        }
      });

    if (candidates.length === 0) {
      return null;
    }

    return Math.max(...candidates);
  }

  private async fetchCbrYuanRate(): Promise<number> {
    const response = await axios.get<{ Valute?: { CNY?: { Value: number; Nominal: number } } }>(
      CBR_DAILY_JSON_URL,
      {
        timeout: 10_000,
        headers: {
          Accept: 'application/json',
        },
      },
    );

    const cny = response.data.Valute?.CNY;
    if (!cny?.Value || !cny.Nominal) {
      throw new Error('CNY rate not found in CBR response');
    }

    const rate = cny.Value / cny.Nominal;
    if (!this.isValidYuanRate(rate)) {
      throw new Error(`Invalid CBR yuan rate: ${rate}`);
    }

    return rate;
  }

  private isValidYuanRate(value: number): boolean {
    return Number.isFinite(value) && value > 8 && value < 20;
  }

  private async saveRate(rate: number, source: string): Promise<void> {
    const entity = this.yuanRateRepository.create({ rate, source });
    await this.yuanRateRepository.save(entity);
  }

  private async getLatestRate(): Promise<number | null> {
    const latest = await this.yuanRateRepository.find({
      order: { fetchedAt: 'DESC' },
      take: 1,
    });

    if (latest.length === 0) {
      return null;
    }

    return decimalToNumber(latest[0].rate);
  }
}
