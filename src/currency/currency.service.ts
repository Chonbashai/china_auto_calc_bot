import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YuanRate } from '../entities/yuan-rate.entity';
import { RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS, VTB_YUAN_URL } from '../config/constants';
import { ManualInputRequiredError } from '../common/errors';
import { PlaywrightService } from '../common/playwright.service';
import { decimalToNumber, withRetry } from '../utils/helpers';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    @InjectRepository(YuanRate)
    private readonly yuanRateRepository: Repository<YuanRate>,
    private readonly playwrightService: PlaywrightService,
  ) {}

  async getYuanRate(manualRate?: number): Promise<number> {
    if (manualRate !== undefined) {
      await this.saveRate(manualRate, 'manual');
      return manualRate;
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
      this.logger.log(`VTB yuan rate fetched: ${rate}`);
      return rate;
    } catch (error) {
      this.logger.error(`VTB rate fetch failed after retries: ${String(error)}`);

      const cached = await this.getLatestRate();
      if (cached !== null) {
        this.logger.warn(`Using cached yuan rate: ${cached}`);
        return cached;
      }

      throw new ManualInputRequiredError(
        'Не удалось получить курс юаня ВТБ. Введите курс вручную.',
        'yuanRate',
      );
    }
  }

  private async fetchRateFromVtb(): Promise<number> {
    try {
      return await this.fetchRateViaAxios();
    } catch (axiosError) {
      this.logger.warn(`VTB axios fetch failed, trying Playwright: ${String(axiosError)}`);
      return this.playwrightService.fetchVtbYuanRate();
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

    const rate = this.parseRateFromHtml(response.data);
    if (rate === null) {
      throw new Error('Unable to parse VTB yuan rate from HTML');
    }

    return rate;
  }

  private parseRateFromHtml(html: string): number | null {
    const $ = cheerio.load(html);
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
          if (Number.isFinite(value) && value > 8 && value < 20) {
            candidates.push(value);
          }
        }
      });

    if (candidates.length === 0) {
      return null;
    }

    return candidates[0];
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
