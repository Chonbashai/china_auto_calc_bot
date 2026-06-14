# Changelog

## [Unreleased]

### Added

- **Месяц и год выпуска** — ввод `MM.YYYY`, точный возраст авто и возрастная группа для Calcus.
- **Статус утильсбора** — «проходной» (льготный) / «не проходной» по мощности (≤160 л.с.), объёму (≤3000 см³) и возрасту.
- **Комиссия банка** — выбор 2%, 2.5% или произвольный процент в wizard.
- **Курс юаня** — приоритет курса продажи ВТБ; fallback на ЦБ РФ; кэш; ручной ввод.
- **Таможня** — бесплатный **Calcus Widget** (`get-widget` + `POST /calculate/Customs`); fallback Playwright; опционально Calcus API через `CALCUS_API_KEY`.

### Fixed

- **Webhook не обрабатывал апдейты Telegram** — маршруты `GET /health` и `POST /telegram/webhook` перенесены с ранней регистрации через `httpAdapter` (до `express.json()`) на NestJS-контроллеры в `TelegramModule`. Явный `express.json()` в `main.ts` (`bodyParser: false` + ручной парсер до маршрутов). Добавлено диагностическое логирование `[WEBHOOK-MW|CTRL|SVC]` через `console.error` (stdout/stderr Docker). При пустом body ответ `noop`, при успехе — `OK`.
- **POST `/telegram/webhook` возвращал 404/400** — маршруты `GET /health` и `POST /telegram/webhook` регистрируются через NestJS-контроллеры. Webhook вызывает `getBot().handleUpdate()` напрямую, всегда отвечает `200 OK`. Health возвращает `{"status":"ok","service":"china-auto-bot"}`.
- **Telegram webhook and Telegraf scenes** — бот не отвечал на `/start`, кнопку «Рассчитать стоимость» и wizard-сценарий.
  - Webhook обрабатывается через стандартный `bot.webhookCallback()` с передачей Express `Response` в `handleUpdate`.
  - Singleton `Telegraf` через `getBot()` — один экземпляр бота на всё приложение.
  - Исправлена инициализация `session()` (убран некорректный `defaultSession` с `cursor: 0`, ломавший Stage/Scenes).
  - Перед запуском калькулятора и при `/start` выполняется `ctx.scene.leave()` — сброс зависшей сцены.
  - Добавлены обработчики `/start` внутри wizard-сцены и расширенное логирование webhook/ошибок Telegraf.
