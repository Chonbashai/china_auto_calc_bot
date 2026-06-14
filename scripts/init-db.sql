-- Создание отдельной базы для бота (выполнить в существующем PostgreSQL)
CREATE DATABASE china_auto_bot
  WITH ENCODING 'UTF8'
       TEMPLATE template0;

-- При необходимости создайте отдельного пользователя:
-- CREATE USER china_auto_bot_user WITH PASSWORD 'strong_password';
-- GRANT ALL PRIVILEGES ON DATABASE china_auto_bot TO china_auto_bot_user;

-- Таблицы создаются автоматически через TypeORM synchronize при первом запуске:
-- yuan_rates
-- calculation_history
