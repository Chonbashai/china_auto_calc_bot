import { Body, Controller, Get, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Update } from 'telegraf/types';
import { TelegramService } from './telegram.service';

function describeUpdate(update: Update): string {
  if ('message' in update && update.message) {
    const text = 'text' in update.message ? update.message.text : undefined;
    return `message${text ? `: ${text.slice(0, 40)}` : ''}`;
  }
  if ('callback_query' in update && update.callback_query) {
    return 'callback_query';
  }
  return Object.keys(update).filter((key) => key !== 'update_id').join(',') || 'unknown';
}

@Controller()
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('telegram/webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    const update = req.body as Update;

    if (!update?.update_id) {
      this.logger.warn(`Invalid webhook payload: ${JSON.stringify(req.body).slice(0, 200)}`);
      res.status(200).send('OK');
      return;
    }

    this.logger.log(`Webhook update ${update.update_id} (${describeUpdate(update)})`);

    try {
      await this.telegramService.handleWebhook(req, res);
      if (!res.writableEnded) {
        res.status(200).send('OK');
      }
    } catch (error) {
      this.logger.error(
        `Webhook handling failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
      );
      if (!res.writableEnded) {
        res.status(200).send('OK');
      }
    }
  }
}
