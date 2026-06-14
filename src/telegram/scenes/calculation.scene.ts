import { Markup, Scenes } from 'telegraf';
import { BotContext, BUTTONS, CALCULATION_SCENE_ID } from '../telegram.types';
import { parsePositiveInteger, parsePositiveNumber } from '../../utils/helpers';
import { parseReleaseMonthYear } from '../../utils/vehicle-age';

interface WizardState {
  model?: string;
  month?: number;
  year?: number;
  engineVolume?: number;
  kw?: number;
  costYuan?: number;
  bankCommissionRate?: number;
}

export function createCalculationScene(
  onComplete: (state: WizardState, ctx: BotContext) => Promise<void>,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    CALCULATION_SCENE_ID,
    async (ctx) => {
      await ctx.reply(
        'Введите марку и модель автомобиля (необязательно):',
        Markup.keyboard([[BUTTONS.SKIP_MODEL], [BUTTONS.CANCEL]]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const state = getWizardState(ctx);
      if (text && text !== BUTTONS.SKIP_MODEL) {
        state.model = text;
      }

      await ctx.reply(
        'Введите месяц и год выпуска (MM.YYYY), например 03.2022:',
        Markup.keyboard([[BUTTONS.CANCEL]]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const parsed = text ? parseReleaseMonthYear(text) : null;
      if (!parsed) {
        await ctx.reply('Введите дату в формате MM.YYYY, например 03.2022:');
        return;
      }

      const state = getWizardState(ctx);
      state.month = parsed.month;
      state.year = parsed.year;

      await ctx.reply(
        'Введите объем двигателя (см³):',
        Markup.keyboard([[BUTTONS.CANCEL]]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const engineVolume = text ? parsePositiveInteger(text) : null;
      if (engineVolume === null) {
        await ctx.reply('Введите корректный объем двигателя (целое число, см³):');
        return;
      }

      getWizardState(ctx).engineVolume = engineVolume;
      await ctx.reply(
        'Введите мощность двигателя (кВт):',
        Markup.keyboard([[BUTTONS.CANCEL]]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const kw = text ? parsePositiveInteger(text) : null;
      if (kw === null) {
        await ctx.reply('Введите корректную мощность (целое число, кВт):');
        return;
      }

      getWizardState(ctx).kw = kw;
      await ctx.reply(
        'Введите себестоимость автомобиля в юанях:',
        Markup.keyboard([[BUTTONS.CANCEL]]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const costYuan = text ? parsePositiveNumber(text) : null;
      if (costYuan === null) {
        await ctx.reply('Введите корректную себестоимость в юанях:');
        return;
      }

      getWizardState(ctx).costYuan = costYuan;
      await ctx.reply(
        'Выберите комиссию банка за конвертацию:',
        Markup.keyboard([
          [BUTTONS.COMMISSION_2, BUTTONS.COMMISSION_25],
          [BUTTONS.COMMISSION_OTHER, BUTTONS.CANCEL],
        ]).resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const state = getWizardState(ctx);

      if (text === BUTTONS.COMMISSION_2) {
        state.bankCommissionRate = 0.02;
        await finishCalculation(ctx, state, onComplete);
        return ctx.scene.leave();
      }

      if (text === BUTTONS.COMMISSION_25) {
        state.bankCommissionRate = 0.025;
        await finishCalculation(ctx, state, onComplete);
        return ctx.scene.leave();
      }

      if (text === BUTTONS.COMMISSION_OTHER) {
        await ctx.reply(
          'Введите комиссию банка в процентах (например 3 или 2.75):',
          Markup.keyboard([[BUTTONS.CANCEL]]).resize(),
        );
        return ctx.wizard.next();
      }

      await ctx.reply('Выберите комиссию банка кнопкой или введите процент вручную.');
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const percent = text ? parsePositiveNumber(text) : null;
      if (percent === null || percent <= 0 || percent > 20) {
        await ctx.reply('Введите корректный процент от 0.1 до 20, например 2.75:');
        return;
      }

      const state = getWizardState(ctx);
      state.bankCommissionRate = percent / 100;
      await finishCalculation(ctx, state, onComplete);
      return ctx.scene.leave();
    },
  );

  scene.command('start', async (ctx) => {
    await ctx.scene.leave();
    await ctx.reply(
      '🚗 Калькулятор авто из Китая',
      Markup.keyboard([[BUTTONS.CALCULATE]]).resize(),
    );
  });

  scene.command('cancel', async (ctx) => {
    await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
    await ctx.scene.leave();
  });

  return scene;
}

async function finishCalculation(
  ctx: BotContext,
  state: WizardState,
  onComplete: (state: WizardState, ctx: BotContext) => Promise<void>,
): Promise<void> {
  await ctx.reply('⏳ Выполняю расчет...', Markup.removeKeyboard());
  await onComplete(state, ctx);
}

function getMessageText(ctx: BotContext): string | undefined {
  if (!ctx.message || !('text' in ctx.message)) {
    return undefined;
  }
  return ctx.message.text.trim();
}

function getWizardState(ctx: BotContext): WizardState {
  const wizardCtx = ctx.wizard as BotContext['wizard'] & { state: WizardState };
  if (!wizardCtx.state) {
    wizardCtx.state = {};
  }
  return wizardCtx.state;
}
