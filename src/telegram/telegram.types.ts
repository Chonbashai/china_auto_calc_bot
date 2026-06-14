import { Scenes } from 'telegraf';
import { CalculationInputDto } from '../calculations/calculation.dto';

export type ManualInputField = 'yuanRate' | 'customs';

export interface BotSession extends Scenes.WizardSessionData {
  pendingInput?: CalculationInputDto;
  awaitingManualField?: ManualInputField;
}

export type BotContext = Scenes.WizardContext<BotSession>;

export const CALCULATION_SCENE_ID = 'calculation-wizard';

export const BUTTONS = {
  CALCULATE: 'Рассчитать стоимость',
  SKIP_MODEL: 'Пропустить',
  CANCEL: 'Отмена',
  COMMISSION_2: '2%',
  COMMISSION_25: '2.5%',
  COMMISSION_OTHER: 'Другая %',
} as const;

export interface PendingCalculation {
  input: CalculationInputDto;
  awaitingField: ManualInputField;
}

export interface ReplyContext {
  from?: { id: number; username?: string };
  reply: BotContext['reply'];
}
