import type { ParseKeys } from 'i18next';
import { LockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { BuqAccess } from '@/features/buq/lib/access';

export type UnavailableKind = Exclude<BuqAccess['kind'], 'ready' | 'no-grant'>;

const REASONS: Record<UnavailableKind, ParseKeys> = {
  'no-home': 'buq.no-home',
  'no-program': 'buq.no-program',
  unsupported: 'buq.unsupported',
};

export function BuqUnavailable({ kind, title }: { kind: UnavailableKind; title: string }) {
  const { t } = useTranslation();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{t(REASONS[kind])}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
