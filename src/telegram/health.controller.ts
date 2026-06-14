import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; service: string; routes: string[]; timestamp: string } {
    return {
      status: 'ok',
      service: 'china-auto-bot',
      routes: ['GET /health', 'POST /telegram/webhook'],
      timestamp: new Date().toISOString(),
    };
  }
}
