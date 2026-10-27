import type { TFunction } from 'i18next';

export function deviceDraftLeaveCopy(
  t: TFunction,
  enabled: boolean,
  signingOut: boolean,
  deviceCopy: 'delete' | 'keep' = 'delete',
) {
  return {
    title: enabled ? t('stock-events.draft-leave-title') : undefined,
    actionLabel: enabled
      ? t(signingOut ? 'stock-events.draft-sign-out' : 'stock-events.draft-leave')
      : undefined,
    description: t(
      enabled
        ? signingOut
          ? 'stock-events.draft-sign-out-description'
          : deviceCopy === 'keep'
            ? 'physical-inventory.draft-leave-description'
            : 'stock-events.draft-leave-description'
        : 'stock-events.discard-description',
    ),
  };
}
