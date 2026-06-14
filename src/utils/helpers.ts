const LOCALE = 'ru-RU';

export function formatRub(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatYuan(value: number): string {
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value))} ¥`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  onError?: (error: unknown, attempt: number) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      onError?.(error, attempt);

      if (attempt < attempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export function parsePositiveNumber(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export function parsePositiveInteger(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '');
  const value = Number.parseInt(normalized, 10);

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export function decimalToNumber(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  return Number.parseFloat(value);
}

import { mapYearToAgeGroupFromYearOnly } from './vehicle-age';

export type CalcusAgeGroup = 'до 3 лет' | 'от 3 до 5 лет' | 'от 5 до 7 лет' | 'более 7 лет';

export function mapYearToAgeGroup(year: number): CalcusAgeGroup {
  return mapYearToAgeGroupFromYearOnly(year);
}

export function parseAmountFromText(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, ' ');
  const match = normalized.match(/(\d[\d\s]*(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}
