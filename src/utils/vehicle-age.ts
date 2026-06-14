import { CalcusAgeGroup } from './helpers';

export const PREFERENTIAL_MAX_HP = 160;
export const PREFERENTIAL_MAX_ENGINE_CC = 3000;

export type CalcusAgeCode = '0-3' | '3-5' | '5-7' | '7-0';

export interface VehicleAgeInfo {
  month: number;
  year: number;
  ageMonths: number;
  ageLabel: string;
  calcusAgeCode: CalcusAgeCode;
  calcusAgeLabel: CalcusAgeGroup;
  isPreferentialUtil: boolean;
  utilStatusLabel: string;
}

export function parseReleaseMonthYear(raw: string): { month: number; year: number } | null {
  const normalized = raw.trim().replace(/\s+/g, '');
  const match = normalized.match(/^(\d{1,2})[./-](\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number.parseInt(match[1], 10);
  const year = Number.parseInt(match[2], 10);
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) {
    return null;
  }

  return { month, year };
}

export function kwToHp(kw: number): number {
  return kw * 1.35962;
}

export function getVehicleAgeMonths(
  month: number,
  year: number,
  referenceDate: Date = new Date(),
): number {
  const manufacture = new Date(year, month - 1, 1);
  const reference = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const diff =
    (reference.getFullYear() - manufacture.getFullYear()) * 12 +
    (reference.getMonth() - manufacture.getMonth());

  return Math.max(diff, 0);
}

export function mapAgeMonthsToCalcusCode(ageMonths: number): CalcusAgeCode {
  if (ageMonths < 36) {
    return '0-3';
  }
  if (ageMonths < 60) {
    return '3-5';
  }
  if (ageMonths < 84) {
    return '5-7';
  }
  return '7-0';
}

export function mapCalcusCodeToLabel(code: CalcusAgeCode): CalcusAgeGroup {
  switch (code) {
    case '0-3':
      return 'до 3 лет';
    case '3-5':
      return 'от 3 до 5 лет';
    case '5-7':
      return 'от 5 до 7 лет';
    case '7-0':
      return 'более 7 лет';
  }
}

export function formatAgeLabel(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;

  if (years === 0) {
    return `${months} мес.`;
  }

  if (months === 0) {
    return `${years} г.`;
  }

  return `${years} г. ${months} мес.`;
}

export function formatReleaseDate(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}.${year}`;
}

export function isPreferentialUtil(params: {
  kw: number;
  engineVolume: number;
  ageMonths: number;
}): boolean {
  const hp = kwToHp(params.kw);

  return (
    params.engineVolume <= PREFERENTIAL_MAX_ENGINE_CC &&
    hp <= PREFERENTIAL_MAX_HP &&
    params.ageMonths < 84
  );
}

export function buildVehicleAgeInfo(
  month: number,
  year: number,
  kw: number,
  engineVolume: number,
  referenceDate: Date = new Date(),
): VehicleAgeInfo {
  const ageMonths = getVehicleAgeMonths(month, year, referenceDate);
  const calcusAgeCode = mapAgeMonthsToCalcusCode(ageMonths);
  const preferential = isPreferentialUtil({ kw, engineVolume, ageMonths });

  return {
    month,
    year,
    ageMonths,
    ageLabel: formatAgeLabel(ageMonths),
    calcusAgeCode,
    calcusAgeLabel: mapCalcusCodeToLabel(calcusAgeCode),
    isPreferentialUtil: preferential,
    utilStatusLabel: preferential
      ? 'льготный (проходной)'
      : 'повышенный (не проходной)',
  };
}

/** @deprecated Используйте buildVehicleAgeInfo с месяцем и годом */
export function mapYearToAgeGroupFromYearOnly(year: number): CalcusAgeGroup {
  const ageMonths = getVehicleAgeMonths(1, year);
  return mapCalcusCodeToLabel(mapAgeMonthsToCalcusCode(ageMonths));
}
