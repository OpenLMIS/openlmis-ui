import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Block, CardFrame, DashboardRow } from '@/features/home/components/dashboard-parts';
import { StatSkeleton, StatStrip } from '@/features/home/components/stat-strip';

/** Each card's body while it loads, shared by the card and the page skeleton; no chart code here. */
export const PENDING = {
  periods: <Block className="h-64 w-full" />,
  statuses: <Block className="h-36 w-full" />,
  equipment: <Block className="h-40 w-full" />,
  approvals: (
    <span aria-busy className="flex flex-col gap-3">
      {['a', 'b', 'c', 'd', 'e'].map((row) => (
        <Block className="h-10 w-full" key={row} />
      ))}
    </span>
  ),
};

/** A card's frame with its real title and a placeholder description and body. */
export function CardSkeleton({ title, pending }: { title: string; pending: ReactNode }) {
  return (
    <CardFrame description={<Block className="h-4 w-48 py-0.5" />} title={title}>
      {pending}
    </CardFrame>
  );
}

/** The dashboard's frame while the user's rights load: the full layout, real titles, placeholder values. */
export function DashboardSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="flex flex-col gap-4 lg:gap-6">
      <StatStrip>
        {(['approve', 'convert', 'orders', 'equipment'] as const).map((stat) => (
          <StatSkeleton key={stat} label={t(`home.stats.${stat}`)} />
        ))}
      </StatStrip>
      <DashboardRow
        narrow={<CardSkeleton pending={PENDING.statuses} title={t('home.statuses.title')} />}
        wide={<CardSkeleton pending={PENDING.periods} title={t('home.periods.title')} />}
      />
      <DashboardRow
        narrow={<CardSkeleton pending={PENDING.equipment} title={t('home.equipment.title')} />}
        wide={<CardSkeleton pending={PENDING.approvals} title={t('home.approvals.title')} />}
      />
    </div>
  );
}

/** Where the header's buttons will be, so the heading does not shift when they arrive. */
export function ActionsSkeleton() {
  return (
    <div className="flex gap-2">
      <Block className="h-10 w-28" />
      <Block className="h-10 w-28" />
    </div>
  );
}
