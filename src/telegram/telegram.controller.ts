import { Body, Controller, Get, HttpCode, Logger, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Update } from 'telegraf/types';
import { TelegramService } from './telegram.service';

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
  async webhook(@Body() update: Update, @Res() res: Response): Promise<void> {
    try {
      await this.telegramService.handleUpdate(update);
      res.status(200).send('OK');
    } catch (error) {
      this.logger.error(`Webhook handling failed: ${String(error)}`);
      res.status(200).send('OK');
    }
  }
}
