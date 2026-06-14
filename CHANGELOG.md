# Changelog

## [Unreleased]

### Fixed

- **Webhook не обрабатывал апдейты Telegram** — маршруты `GET /health` и `POST /telegram/webhook` перенесены с ранней регистрации через `httpAdapter` (до `express.json()`) на NestJS-контроллеры в `TelegramModule`. Теперь `req.body` парсится корректно и передаётся в singleton `Telegraf` через `handleUpdate(update)` без `Response`, после чего webhook всегда отвечает `200 OK`.
- **POST `/telegram/webhook` возвращал 404/400** — маршруты `GET /health` и `POST /telegram/webhook` регистрируются через NestJS-контроллеры. Webhook вызывает `getBot().handleUpdate()` напрямую, всегда отвечает `200 OK`. Health возвращает `{"status":"ok","service":"china-auto-bot"}`.
- **Telegram webhook and Telegraf scenes** — бот не отвечал на `/start`, кнопку «Рассчитать стоимость» и wizard-сценарий.
  - Webhook обрабатывается через стандартный `bot.webhookCallback()` с передачей Express `Response` в `handleUpdate`.
  - Singleton `Telegraf` через `getBot()` — один экземпляр бота на всё приложение.
  - Исправлена инициализация `session()` (убран некорректный `defaultSession` с `cursor: 0`, ломавший Stage/Scenes).
  - Перед запуском калькулятора и при `/start` выполняется `ctx.scene.leave()` — сброс зависшей сцены.
  - Добавлены обработчики `/start` внутри wizard-сцены и расширенное логирование webhook/ошибок Telegraf.
