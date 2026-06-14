import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { CalculateCustomsDto } from '../calculations/calculation.dto';
import { CALCUS_CUSTOMS_URL, RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from '../config/constants';
import { ManualInputRequiredError } from '../common/errors';
import { PlaywrightService } from '../common/playwright.service';
import { mapYearToAgeGroup, parseAmountFromText, withRetry } from '../utils/helpers';

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

  constructor(private readonly playwrightService: PlaywrightService) {}

  async calculateCustoms(dto: CalculateCustomsDto, manualCustoms?: number): Promise<number> {
    if (manualCustoms !== undefined) {
      return manualCustoms;
    }

    try {
      const customs = await withRetry(
        () => this.scrapeCustoms(dto),
        RETRY_ATTEMPTS,
        RETRY_BASE_DELAY_MS,
        (error, attempt) => {
          this.logger.warn(`Calcus attempt ${attempt} failed: ${String(error)}`);
        },
      );

      this.logger.log(`Calcus customs calculated: ${customs}`);
      return customs;
    } catch (error) {
      this.logger.error(`Calcus customs calculation failed: ${String(error)}`);
      throw new ManualInputRequiredError(
        'Не удалось рассчитать таможню через Calcus. Введите сумму таможни вручную (₽).',
        'customs',
      );
    }
  }

  private async scrapeCustoms(dto: CalculateCustomsDto): Promise<number> {
    return this.playwrightService.withPage(async (page) => {
      await page.goto(CALCUS_CUSTOMS_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await this.dismissCookieBanner(page);

      await page.locator('select[name="owner"]').selectOption({ index: 0 });
      await page.locator('select[name="age"]').selectOption({ label: mapYearToAgeGroup(dto.year) });
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
    }

    await page.waitForTimeout(4_000);
  }

  private async extractCustomsTotal(page: Page): Promise<number | null> {
    const bodyText = await page.locator('body').innerText();
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
