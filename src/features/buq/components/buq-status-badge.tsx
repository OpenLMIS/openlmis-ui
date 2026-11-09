import { Badge } from '@/components/ui/badge';
import { BUQ_STATUS } from '@/features/buq/lib/buq-status';
import type { BuqStatus } from '@/features/buq/lib/types';

export function BuqStatusBadge({ status, label }: { status: BuqStatus; label: string }) {
  const { tone, icon: Icon } = BUQ_STATUS[status];
  return (
    <Badge variant={tone}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}
