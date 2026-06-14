import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Telegraf, session, Scenes, Markup } from 'telegraf';
import { Update } from 'telegraf/types';
import { AppConfig } from '../config/constants';
import { CalculationsService } from '../calculations/calculations.service';
import { CalculationInputDto } from '../calculations/calculation.dto';
import { HistoryService } from '../history/history.service';
import { AdminService } from '../admin/admin.service';
import { ManualInputRequiredError } from '../common/errors';
import { parsePositiveNumber } from '../utils/helpers';
import { createCalculationScene } from './scenes/calculation.scene';
import {
  BotContext,
  BUTTONS,
  CALCULATION_SCENE_ID,
  ManualInputField,
  PendingCalculation,
  ReplyContext,
} from './telegram.types';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<BotContext> | null = null;
  private webhookMiddleware:
    | ((req: Request, res: Response, next: () => void) => Promise<void>)
    | null = null;
  private readonly pendingCalculations = new Map<number, PendingCalculation>();

  constructor(
    private readonly configService: ConfigService,
    private readonly calculationsService: CalculationsService,
    private readonly historyService: HistoryService,
    private readonly adminService: AdminService,
  ) {}

  private get appConfig(): AppConfig {
    const config = this.configService.get<AppConfig>('app');
    if (!config) {
      throw new Error('Application configuration is not loaded');
    }
    return config;
  }

  async onModuleInit(): Promise<void> {
    this.validateConfig();
    this.bot = this.createBot();
    await this.registerWebhook();
  }

  onModuleDestroy(): void {
    if (this.bot) {
      void this.bot.stop('NestJS shutdown');
    }
  }

  getBot(): Telegraf<BotContext> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }
    return this.bot;
  }

  async handleUpdate(update: Update, response?: Response): Promise<void> {
    await this.getBot().handleUpdate(update, response);
  }

  getWebhookCallback(): (req: Request, res: Response, next: () => void) => Promise<void> {
    if (!this.webhookMiddleware) {
      throw new Error('Telegram webhook middleware is not initialized');
    }
    return this.webhookMiddleware;
  }

  async processWebhookRequest(req: Request, res: Response): Promise<void> {
    this.logger.log(`Webhook POST ${req.originalUrl ?? req.url}`);

    const previousUrl = req.url;
    req.url = '/telegram/webhook';

    try {
      await this.getWebhookCallback()(req, res, () => {
        if (!res.writableEnded) {
          res.status(200).send('OK');
        }
      });
    } finally {
      req.url = previousUrl;
    }
  }

  private validateConfig(): void {
    if (!this.appConfig.botToken) {
      throw new Error('BOT_TOKEN is required');
    }

    if (!this.appConfig.webhookUrl) {
      throw new Error('WEBHOOK_URL is required');
    }
  }

  private createBot(): Telegraf<BotContext> {
    const bot = new Telegraf<BotContext>(this.appConfig.botToken);

    bot.use(
      session({
        defaultSession: () => ({}),
      }),
    );

    const calculationScene = createCalculationScene(async (state, ctx) => {
      if (!ctx.from) {
        return;
      }

      const input: CalculationInputDto = {
        model: state.model,
        year: state.year!,
        engineVolume: state.engineVolume!,
        kw: state.kw!,
        costYuan: state.costYuan!,
      };

      await this.runCalculation(ctx, input);
    });

    const stage = new Scenes.Stage<BotContext>([calculationScene]);
    bot.use(stage.middleware());

    bot.start(async (ctx) => {
      this.logger.log(`Command /start from user ${ctx.from?.id ?? 'unknown'}`);
      await ctx.scene.leave();
      await this.replyWithMainMenu(ctx);
    });

    bot.hears(BUTTONS.CALCULATE, async (ctx) => {
      this.logger.log(`Calculate button from user ${ctx.from?.id ?? 'unknown'}`);
      await ctx.scene.leave();
      await ctx.scene.enter(CALCULATION_SCENE_ID);
    });

    bot.command('history', async (ctx) => {
      if (!ctx.from) {
        return;
      }

      try {
        const records = await this.historyService.getUserHistory(ctx.from.id);
        await ctx.reply(this.historyService.formatHistoryMessage(records));
      } catch (error) {
        this.logger.error(`History command failed: ${String(error)}`);
        await ctx.reply('Не удалось загрузить историю. Попробуйте позже.');
      }
    });

    bot.command('stats', async (ctx) => {
      if (!ctx.from) {
        return;
      }

      if (!this.appConfig.adminIds.includes(ctx.from.id)) {
        await ctx.reply('Команда доступна только администраторам.');
        return;
      }

      try {
        const stats = await this.adminService.getStats();
        await ctx.reply(this.adminService.formatStatsMessage(stats));
      } catch (error) {
        this.logger.error(`Stats command failed: ${String(error)}`);
        await ctx.reply('Не удалось получить статистику. Попробуйте позже.');
      }
    });

    bot.on('text', async (ctx, next) => {
      if (!ctx.from) {
        return next();
      }

      if (this.pendingCalculations.has(ctx.from.id)) {
        await this.handleManualInput(ctx);
        return;
      }

      return next();
    });

    bot.catch(async (error, ctx) => {
      this.logger.error(
        `Telegram error for update ${ctx.updateType}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
      );

      try {
        await ctx.reply('Произошла ошибка. Попробуйте /start или нажмите «Рассчитать стоимость».');
      } catch (replyError) {
        this.logger.error(
          `Failed to send error reply: ${replyError instanceof Error ? replyError.message : String(replyError)}`,
        );
      }
    });

    this.webhookMiddleware = bot.webhookCallback('/telegram/webhook');
    return bot;
  }

  private async replyWithMainMenu(ctx: ReplyContext): Promise<void> {
    await ctx.reply(
      '🚗 Калькулятор авто из Китая',
      Markup.keyboard([[BUTTONS.CALCULATE]]).resize(),
    );
  }

  private async registerWebhook(): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      const currentInfo = await this.bot.telegram.getWebhookInfo();
      const currentUrl = currentInfo.url ?? '';

      if (currentUrl === this.appConfig.webhookUrl) {
        this.logger.log(
          `Webhook already registered: ${this.maskWebhookUrl(this.appConfig.webhookUrl)}`,
        );
        return;
      }

      if (currentUrl) {
        this.logger.log(`Replacing webhook: ${this.maskWebhookUrl(currentUrl)}`);
      }

      await this.bot.telegram.setWebhook(this.appConfig.webhookUrl, {
        drop_pending_updates: true,
        allowed_updates: ['message', 'edited_message'],
      });
      this.logger.log(`Webhook registered: ${this.maskWebhookUrl(this.appConfig.webhookUrl)}`);
    } catch (error) {
      this.logger.error(`Webhook registration failed: ${String(error)}`);
      throw error;
    }
  }

  private async runCalculation(ctx: ReplyContext, input: CalculationInputDto): Promise<void> {
    if (!ctx.from) {
      return;
    }

    try {
      const result = await this.calculationsService.calculate(input);
      await this.historyService.saveCalculation(ctx.from.id, ctx.from.username, result);
      await ctx.reply(this.calculationsService.buildResultMessage(result));
      await ctx.reply(
        'Можете выполнить новый расчет.',
        Markup.keyboard([[BUTTONS.CALCULATE]]).resize(),
      );
      this.pendingCalculations.delete(ctx.from.id);
    } catch (error) {
      if (error instanceof ManualInputRequiredError) {
        this.pendingCalculations.set(ctx.from.id, {
          input,
          awaitingField: error.field,
        });
        await ctx.reply(error.message);
        return;
      }

      this.logger.error(`Calculation failed: ${String(error)}`);
      await ctx.reply(
        'Произошла ошибка при расчете. Попробуйте позже или начните заново.',
        Markup.keyboard([[BUTTONS.CALCULATE]]).resize(),
      );
      this.pendingCalculations.delete(ctx.from.id);
    }
  }

  private async handleManualInput(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
      return;
    }

    const pending = this.pendingCalculations.get(ctx.from.id);
    if (!pending) {
      return;
    }

    const value = parsePositiveNumber(ctx.message.text);
    if (value === null) {
      await ctx.reply('Введите корректное положительное число.');
      return;
    }

    const field: ManualInputField = pending.awaitingField;
    const input: CalculationInputDto = { ...pending.input };

    if (field === 'yuanRate') {
      input.yuanRate = value;
    } else {
      input.customs = value;
    }

    this.pendingCalculations.delete(ctx.from.id);
    await ctx.reply('⏳ Продолжаю расчет...');
    await this.runCalculation(ctx, input);
  }

  private maskWebhookUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return '[invalid webhook url]';
    }
  }
}
