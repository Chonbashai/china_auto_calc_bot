import { Controller, Get } from '@nestjs/common';

/**
 * Дублирует маршрут из main.ts (httpAdapter).
 * Основная регистрация — в bootstrap() через httpAdapter.get('/health').
 */
@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'china-auto-bot',
    };
  }
}
