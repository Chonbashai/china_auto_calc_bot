import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

/**
 * Дублирует маршрут из main.ts (httpAdapter).
 * Основная регистрация — в bootstrap() через httpAdapter.post('/telegram/webhook').
 */
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.telegramService.processWebhookRequest(req, res);
  }
}
