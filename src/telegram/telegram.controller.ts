import { Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.logger.log(`POST ${req.originalUrl ?? req.url}`);

    // Telegraf webhook filter compares req.url with the hook path exactly.
    const previousUrl = req.url;
    req.url = '/telegram/webhook';

    try {
      await this.telegramService.getBot().webhookCallback('/telegram/webhook')(req, res, () => {
        if (!res.writableEnded) {
          res.status(200).send('OK');
        }
      });
    } finally {
      req.url = previousUrl;
    }
  }
}
