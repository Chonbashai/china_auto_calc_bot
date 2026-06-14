import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    console.error(
      `[WEBHOOK-CTRL] body=${JSON.stringify(body ?? null)} req.body=${JSON.stringify(req.body ?? null)}`,
    );

    const payload = body ?? req.body;
    await this.telegramService.processWebhookRequest(payload, res);
  }
}
