# Changelog

## [Unreleased]

### Fixed

- **Telegram webhook and Telegraf scenes** — бот не отвечал на `/start`, кнопку «Рассчитать стоимость» и wizard-сценарий.
  - Webhook теперь обрабатывается через стандартный `bot.webhookCallback()` с передачей Express `Response` в `handleUpdate`.
  - Исправлена инициализация `session()` (убран некорректный `defaultSession` с `cursor: 0`, ломавший Stage/Scenes).
  - Перед запуском калькулятора и при `/start` выполняется `ctx.scene.leave()` — сброс зависшей сцены.
  - Добавлены обработчики `/start` внутри wizard-сцены и расширенное логирование webhook/ошибок Telegraf.
