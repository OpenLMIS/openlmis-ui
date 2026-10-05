import type { ParseKeys } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReasonLabels } from '@/features/reasons/lib/reasons-list';

const CATEGORY_KEYS: Partial<Record<string, ParseKeys>> = {
  TRANSFER: 'reasons.category-transfer',
  ADJUSTMENT: 'reasons.category-adjustment',
  PHYSICAL_INVENTORY: 'reasons.category-physical-inventory',
  AGGREGATION: 'reasons.category-aggregation',
};

const TYPE_KEYS: Partial<Record<string, ParseKeys>> = {
  CREDIT: 'reasons.type-credit',
  DEBIT: 'reasons.type-debit',
  BALANCE_ADJUSTMENT: 'reasons.type-balance-adjustment',
};

/** Codes in words; a code the server added later stays as it is. */
export function useReasonLabels(): ReasonLabels {
  const { t } = useTranslation();
  return useMemo(() => {
    const label = (keys: Partial<Record<string, ParseKeys>>) => (code: string) => {
      const key = keys[code];
      return key ? t(key) : code;
    };
    return { category: label(CATEGORY_KEYS), type: label(TYPE_KEYS) };
  }, [t]);
}
