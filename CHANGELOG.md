# Changelog

## [Unreleased]

### Fixed

- **POST `/telegram/webhook` возвращал 404** — маршрут `@Controller('telegram')` + `@Post('webhook')` в `AppModule`, обработка через singleton `getBot().webhookCallback()`. POST всегда возвращает 200 OK. Health теперь содержит `"service":"china-auto-bot"` для проверки, что NPM проксирует на правильный контейнер.
- **Telegram webhook and Telegraf scenes** — бот не отвечал на `/start`, кнопку «Рассчитать стоимость» и wizard-сценарий.
  - Webhook обрабатывается через стандартный `bot.webhookCallback()` с передачей Express `Response` в `handleUpdate`.
  - Singleton `Telegraf` через `getBot()` — один экземпляр бота на всё приложение.
  - Исправлена инициализация `session()` (убран некорректный `defaultSession` с `cursor: 0`, ломавший Stage/Scenes).
  - Перед запуском калькулятора и при `/start` выполняется `ctx.scene.leave()` — сброс зависшей сцены.
  - Добавлены обработчики `/start` внутри wizard-сцены и расширенное логирование webhook/ошибок Telegraf.
