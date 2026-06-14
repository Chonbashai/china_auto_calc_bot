import { registerAs } from '@nestjs/config';
import { AppConfig } from './constants';

function parseAdminIds(raw: string | undefined): number[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id));
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    botToken: process.env.BOT_TOKEN ?? '',
    databaseUrl: process.env.DATABASE_URL ?? '',
    webhookUrl: process.env.WEBHOOK_URL ?? '',
    adminIds: parseAdminIds(process.env.ADMIN_IDS),
    calcusApiKey: process.env.CALCUS_API_KEY ?? '',
    defaultBankCommissionRate: Number.parseFloat(
      process.env.DEFAULT_BANK_COMMISSION ?? '0.025',
    ),
    cbrFallbackEnabled: (process.env.CBR_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false',
  }),
);
