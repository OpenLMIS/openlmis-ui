import type { TFunction } from 'i18next';
import { Badge } from '@/components/ui/badge';
import { BUQ_STATUS } from '@/features/buq/lib/buq-status';
import type { BuqStatus } from '@/features/buq/lib/types';

export function buqStatusBadge(t: TFunction, status: BuqStatus) {
  const { labelKey, tone, icon: Icon } = BUQ_STATUS[status];
  return (
    <Badge variant={tone}>
      <Icon data-icon="inline-start" />
      {t(labelKey)}
    </Badge>
  );
}
