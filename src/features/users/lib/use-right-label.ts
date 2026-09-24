import type { ParseKeys } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rightLabel } from '@/features/users/lib/role-assignments';

/** A right's translated name, or its code as words for a right this app has no label for. */
export function useRightLabel() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (name: string) => {
      const key = `rights.${name.toLowerCase().replaceAll('_', '-')}`;
      return i18n.exists(key) ? t(key as ParseKeys) : rightLabel(name);
    },
    [t, i18n],
  );
}
