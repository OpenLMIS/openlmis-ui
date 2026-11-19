import type { ParseKeys } from 'i18next';
import { FilePenIcon, type LucideIcon, SendIcon, XIcon } from 'lucide-react';
import type { BuqStatus } from '@/features/buq/lib/types';

type StatusStyle = {
  labelKey: ParseKeys;
  tone: 'secondary' | 'info' | 'destructive';
  icon: LucideIcon;
};

export const BUQ_STATUS: Record<BuqStatus, StatusStyle> = {
  DRAFT: { labelKey: 'buq.status.draft', tone: 'secondary', icon: FilePenIcon },
  SUBMITTED: { labelKey: 'buq.status.submitted', tone: 'info', icon: SendIcon },
  REJECTED: { labelKey: 'buq.status.rejected', tone: 'destructive', icon: XIcon },
};
