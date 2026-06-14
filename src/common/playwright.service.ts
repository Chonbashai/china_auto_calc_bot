import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, chromium, Page, Response } from 'playwright';
import { VTB_YUAN_URL } from '../config/constants';

@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  async withPage<T>(operation: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      return await operation(page);
    } finally {
      await page.close();
    }
  }

  async fetchVtbYuanRate(): Promise<number> {
    return this.withPage(async (page) => {
      const capturedRates: number[] = [];

      const onResponse = async (response: Response): Promise<void> => {
        const contentType = response.headers()['content-type'] ?? '';
        if (!contentType.includes('json')) {
          return;
        }

        try {
          const body = await response.text();
          const rate = this.extractRateFromJsonText(body);
          if (rate !== null) {
            capturedRates.push(rate);
          }
        } catch {
          // ignore non-JSON payloads
        }
      };

      page.on('response', onResponse);

      try {
        await page.goto(VTB_YUAN_URL, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });

        await page.waitForTimeout(5_000);

        if (capturedRates.length > 0) {
          return capturedRates[0];
        }

        const bodyText = await page.locator('body').innerText();
        const rate = this.parseRateFromText(bodyText);

        if (rate === null) {
          throw new Error('Unable to parse VTB yuan rate via Playwright');
        }

        this.logger.log(`VTB yuan rate parsed via Playwright: ${rate}`);
        return rate;
      } finally {
        page.off('response', onResponse);
      }
    });
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.logger.log('Launching Playwright browser');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    return this.browser;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private extractRateFromJsonText(text: string): number | null {
    const patterns = [
      /"CNY"[^}]*?"sell"[^}]*?(\d{1,2}[.,]\d{2,4})/i,
      /"CNY"[^}]*?"sale"[^}]*?(\d{1,2}[.,]\d{2,4})/i,
      /"code"\s*:\s*"CNY"[^}]*?"value"\s*:\s*(\d{1,2}[.,]\d{2,4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = Number.parseFloat(match[1].replace(',', '.'));
        if (this.isValidYuanRate(value)) {
          return value;
        }
      }
    }

    return null;
  }

  private parseRateFromText(text: string): number | null {
    const normalized = text.replace(/\u00a0/g, ' ');

    const labeledMatches = [
      ...normalized.matchAll(/(?:продаж|покуп|курс)[^\d]{0,40}(\d{1,2}[.,]\d{2,4})/giu),
    ];

    const candidates = labeledMatches
      .map((match) => Number.parseFloat(match[1].replace(',', '.')))
      .filter((value) => this.isValidYuanRate(value));

    if (candidates.length > 0) {
      return candidates[0];
    }

    const allRates = [...normalized.matchAll(/(\d{1,2}[.,]\d{2,4})/g)]
      .map((match) => Number.parseFloat(match[1].replace(',', '.')))
      .filter((value) => this.isValidYuanRate(value));

    if (allRates.length === 0) {
      return null;
    }

    return allRates[0];
  }

  private isValidYuanRate(value: number): boolean {
    return Number.isFinite(value) && value > 8 && value < 20;
  }
}
