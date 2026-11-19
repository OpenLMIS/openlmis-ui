import type { ParseKeys } from 'i18next';
import {
  BadgeCheckIcon,
  CheckIcon,
  FilePenIcon,
  type LucideIcon,
  SendIcon,
  ShieldCheckIcon,
  TimerIcon,
  XIcon,
} from 'lucide-react';
import type { BuqStatus } from '@/features/buq/lib/types';

type StatusStyle = {
  labelKey: ParseKeys;
  tone: 'secondary' | 'info' | 'success' | 'destructive';
  icon: LucideIcon;
};

export const BUQ_STATUS: Record<BuqStatus, StatusStyle> = {
  DRAFT: { labelKey: 'buq.status.draft', tone: 'secondary', icon: FilePenIcon },
  SUBMITTED: { labelKey: 'buq.status.submitted', tone: 'info', icon: SendIcon },
  AUTHORIZED: { labelKey: 'buq.status.authorized', tone: 'info', icon: ShieldCheckIcon },
  IN_APPROVAL: { labelKey: 'buq.status.in-approval', tone: 'info', icon: TimerIcon },
  APPROVED: { labelKey: 'buq.status.approved', tone: 'success', icon: CheckIcon },
  APPROVED_BY_NQT: {
    labelKey: 'buq.status.approved-by-nqt',
    tone: 'success',
    icon: BadgeCheckIcon,
  },
  REJECTED: { labelKey: 'buq.status.rejected', tone: 'destructive', icon: XIcon },
};
