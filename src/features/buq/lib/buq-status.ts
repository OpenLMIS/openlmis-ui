import type { ParseKeys } from 'i18next';
import type { BuqStatus } from '@/features/buq/lib/types';

type StatusStyle = { labelKey: ParseKeys; tone: 'secondary' | 'info' | 'destructive' };

export const BUQ_STATUS: Record<BuqStatus, StatusStyle> = {
  DRAFT: { labelKey: 'buq.status.draft', tone: 'secondary' },
  SUBMITTED: { labelKey: 'buq.status.submitted', tone: 'info' },
  REJECTED: { labelKey: 'buq.status.rejected', tone: 'destructive' },
};
