import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';
import { AppConfig } from '../config/constants';
import { CalcusAgeCode } from '../utils/vehicle-age';
import { parseCalcusMoney } from '../utils/helpers';

export interface CalcusWidgetCalculateParams {
  age: CalcusAgeCode;
  engineVolume: number;
  kw: number;
  costYuan: number;
}

interface CachedWidgetForm {
  html: string;
  action: string;
  expiresAt: number;
}

interface CalcusCalculateResponse {
  total?: string | number;
  total2?: string | number;
  sbor?: string | number;
  util?: string | number;
}

const WIDGET_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class CalcusWidgetClient {
  private readonly logger = new Logger(CalcusWidgetClient.name);
  private cachedForm: CachedWidgetForm | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get appConfig(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  async calculate(params: CalcusWidgetCalculateParams): Promise<number> {
    const form = await this.getWidgetForm();
    const body = this.buildFormBody(form.html, params);

    this.logger.debug(`Calcus widget POST ${form.action}`);

    const response = await axios.post<CalcusCalculateResponse>(form.action, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: 'https://calcus.ru/rastamozhka-auto',
        Origin: 'https://calcus.ru',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30_000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const total = parseCalcusMoney(response.data.total ?? '');
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error(`Calcus widget returned invalid total: ${String(response.data.total)}`);
    }

    return Math.round(total);
  }

  private async getWidgetForm(): Promise<{ html: string; action: string }> {
    const now = Date.now();
    if (this.cachedForm && this.cachedForm.expiresAt > now) {
      return this.cachedForm;
    }

    const domain = this.appConfig.calcusWidgetDomain;
    const url = `https://calcus.ru/get-widget?calc=Customs&domain=${encodeURIComponent(domain)}`;

    this.logger.log(`Loading Calcus widget form for domain ${domain}`);

    const response = await axios.get<{ html: string }>(url, {
      headers: {
        Referer: 'https://calcus.ru/widget/Customs',
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      timeout: 20_000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (!response.data.html) {
      throw new Error('Calcus widget HTML is empty');
    }

    const $ = cheerio.load(response.data.html);
    const formElement = $('form.calc-form');
    const actionAttr = formElement.attr('action');

    if (!actionAttr) {
      throw new Error('Calcus widget form action not found');
    }

    const action = new URL(actionAttr, 'https://calcus.ru').href;
    this.cachedForm = {
      html: response.data.html,
      action,
      expiresAt: now + WIDGET_CACHE_TTL_MS,
    };

    return this.cachedForm;
  }

  private buildFormBody(html: string, params: CalcusWidgetCalculateParams): URLSearchParams {
    const $ = cheerio.load(html);
    const form = $('form.calc-form');
    const urlParams = new URLSearchParams();

    const values: Record<string, string> = {
      owner: '1',
      age: params.age,
      engine: '1',
      power: String(params.kw),
      power_unit: '2',
      value: String(params.engineVolume),
      price: String(Math.round(params.costYuan)),
      curr: 'CNY',
    };

    form.find('input, select, textarea').each((_, element) => {
      const name = $(element).attr('name');
      if (!name) {
        return;
      }

      const tag = element.tagName.toLowerCase();
      const type = ($(element).attr('type') ?? '').toLowerCase();

      if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        if ($(element).attr('checked') !== undefined) {
          urlParams.append(name, $(element).attr('value') ?? '1');
        }
        return;
      }

      if (name in values) {
        urlParams.set(name, values[name]);
        return;
      }

      if (tag === 'select') {
        const selected =
          $(element).find('option[selected]').attr('value') ??
          $(element).find('option').first().attr('value');
        if (selected) {
          urlParams.set(name, selected);
        }
        return;
      }

      const defaultValue = $(element).attr('value') ?? '';
      if (defaultValue) {
        urlParams.set(name, defaultValue);
      }
    });

    for (const [name, value] of Object.entries(values)) {
      urlParams.set(name, value);
    }

    return urlParams;
  }
}
