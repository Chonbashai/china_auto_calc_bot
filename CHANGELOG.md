# Changelog

## [Unreleased]

### Fixed

- **POST `/telegram/webhook` возвращал 404** — маршрут зарегистрирован в `AppModule`: `@Controller('telegram')` + `@Post('webhook')`. POST всегда возвращает 200 OK и проксирует тело в Telegraf `webhookCallback` (singleton `getBot()`). GET на этот путь по-прежнему 404.
- **Telegram webhook and Telegraf scenes** — бот не отвечал на `/start`, кнопку «Рассчитать стоимость» и wizard-сценарий.
  - Webhook обрабатывается через стандартный `bot.webhookCallback()` с передачей Express `Response` в `handleUpdate`.
  - Singleton `Telegraf` через `getBot()` — один экземпляр бота на всё приложение.
  - Исправлена инициализация `session()` (убран некорректный `defaultSession` с `cursor: 0`, ломавший Stage/Scenes).
  - Перед запуском калькулятора и при `/start` выполняется `ctx.scene.leave()` — сброс зависшей сцены.
  - Добавлены обработчики `/start` внутри wizard-сцены и расширенное логирование webhook/ошибок Telegraf.
