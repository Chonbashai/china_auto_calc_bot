export interface AppConfig {
  port: number;
  nodeEnv: string;
  botToken: string;
  databaseUrl: string;
  webhookUrl: string;
  adminIds: number[];
}

export const VTB_YUAN_URL = 'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/yuan/';

export const CALCUS_CUSTOMS_URL = 'https://calcus.ru/rastamozhka-auto';

export const FIXED_COSTS = {
  commission: 65_000,
  broker: 50_000,
  lab: 50_000,
  registration: 10_000,
} as const;

export const BANK_COMMISSION_RATE = 0.025;

export const RETRY_ATTEMPTS = 3;

export const RETRY_BASE_DELAY_MS = 1_000;
