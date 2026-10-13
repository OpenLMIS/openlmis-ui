import type { TFunction } from 'i18next';

export const vvmItems = (t: TFunction) => [
  { value: '', label: t('stock-events.vvm-none') },
  { value: 'STAGE_1', label: t('stock-events.stage-1') },
  { value: 'STAGE_2', label: t('stock-events.stage-2') },
];
