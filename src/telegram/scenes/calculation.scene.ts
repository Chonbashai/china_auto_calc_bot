import { Markup, Scenes } from 'telegraf';
import { BotContext, BUTTONS, CALCULATION_SCENE_ID } from '../telegram.types';
import { parsePositiveInteger, parsePositiveNumber } from '../../utils/helpers';

interface WizardState {
  model?: string;
  year?: number;
  engineVolume?: number;
  kw?: number;
  costYuan?: number;
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

      await ctx.reply('Введите год выпуска:', Markup.keyboard([[BUTTONS.CANCEL]]).resize());
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);
      if (text === BUTTONS.CANCEL) {
        await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
        return ctx.scene.leave();
      }

      const year = text ? parsePositiveInteger(text) : null;
      const currentYear = new Date().getFullYear();

      if (year === null || year < 1990 || year > currentYear + 1) {
        await ctx.reply(`Введите корректный год (1990–${currentYear + 1}):`);
        return;
      }

      getWizardState(ctx).year = year;
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

      const state = getWizardState(ctx);
      state.costYuan = costYuan;

      await ctx.reply('⏳ Выполняю расчет...', Markup.removeKeyboard());
      await onComplete(state, ctx);
      return ctx.scene.leave();
    },
  );

  scene.command('cancel', async (ctx) => {
    await ctx.reply('Расчет отменен.', Markup.removeKeyboard());
    await ctx.scene.leave();
  });

  return scene;
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
