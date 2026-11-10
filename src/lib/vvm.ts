import type { TFunction } from 'i18next';

export const vvmStages = (t: TFunction) => [
  { value: 'STAGE_1' as const, label: t('vvm.stage-1') },
  { value: 'STAGE_2' as const, label: t('vvm.stage-2') },
];

export const vvmItems = (t: TFunction) => [{ value: '', label: t('vvm.none') }, ...vvmStages(t)];
