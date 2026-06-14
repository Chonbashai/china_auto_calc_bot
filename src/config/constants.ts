export type YuanRateSource = 'vtb' | 'cbr' | 'cache' | 'manual';

export interface YuanRateQuote {
  rate: number;
  source: YuanRateSource;
  sourceLabel: string;
}

export interface CustomsCalculationResult {
  total: number;
  isPreferentialUtil: boolean;
  utilStatusLabel: string;
  ageLabel: string;
  calcusAgeLabel: string;
  source: 'calcus-api' | 'calcus-scrape' | 'manual';
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  botToken: string;
  databaseUrl: string;
  webhookUrl: string;
  adminIds: number[];
  calcusApiKey: string;
  defaultBankCommissionRate: number;
  cbrFallbackEnabled: boolean;
}

export const VTB_YUAN_URL = 'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/yuan/';

export const CBR_DAILY_JSON_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

export const CALCUS_CUSTOMS_URL = 'https://calcus.ru/rastamozhka-auto';

export const CALCUS_API_URL = 'https://calcus.ru/api/Customs';

export const FIXED_COSTS = {
  commission: 65_000,
  broker: 50_000,
  lab: 50_000,
  registration: 10_000,
} as const;

export const BANK_COMMISSION_RATE = 0.025;

export const DEFAULT_BANK_COMMISSION_OPTIONS = [0.02, 0.025] as const;

export const RETRY_ATTEMPTS = 3;

export const RETRY_BASE_DELAY_MS = 1_000;
