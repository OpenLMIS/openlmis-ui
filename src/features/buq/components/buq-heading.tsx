import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import type { NamedItem } from '@/features/buq/lib/types';

export function BuqHeading({ facility, program }: { facility: NamedItem; program: NamedItem }) {
  const { t } = useTranslation();
  return (
    <h2 className="truncate font-semibold text-base">
      {t('buq.heading', { facility: facility.name, program: program.name })}
    </h2>
  );
}

export function BuqHeadingSkeleton() {
  return (
    <div className="flex h-6 items-center">
      <div className="h-4 w-64 max-w-full">
        <Skeleton fill />
      </div>
    </div>
  );
}
