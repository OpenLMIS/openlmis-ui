import type { ReactNode, Ref } from 'react';
import { DataTableCard, DataTablePagerCard } from '@/components/data-table/data-table';
import { DataTablePaginationSkeleton } from '@/components/data-table/data-table-pagination';
import { SettingsRowFrame } from '@/components/form/settings-list';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type CardListProps = {
  empty?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  listRef?: Ref<HTMLUListElement>;
  children?: ReactNode;
};

export function CardList({ empty, footer, busy = false, listRef, children }: CardListProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div aria-busy={busy || undefined} className="transition-opacity aria-busy:opacity-60">
        {empty ? (
          <DataTableCard>{empty}</DataTableCard>
        ) : (
          <ul
            className="flex scroll-mt-page-start flex-col gap-4 outline-none"
            ref={listRef}
            tabIndex={-1}
          >
            {children}
          </ul>
        )}
      </div>
      {footer && <DataTablePagerCard>{footer}</DataTablePagerCard>}
    </div>
  );
}

export function CardListItem({ children }: { children: ReactNode }) {
  return (
    <li className="scroll-mt-page-start">
      <DataTableCard>
        <div className="divide-y">{children}</div>
      </DataTableCard>
    </li>
  );
}

export function CardBand({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 bg-muted/50 px-4 py-1.5 font-semibold text-sm">
      {children}
    </div>
  );
}

export function CardSelectBand({
  htmlFor,
  selected,
  disabled = false,
  children,
}: {
  htmlFor: string;
  selected: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'flex min-h-10 items-center gap-3 px-4 py-1.5 font-semibold text-sm transition-colors',
        selected ? 'bg-primary/5' : 'bg-muted/50',
        !disabled && 'cursor-pointer',
      )}
    >
      {children}
    </label>
  );
}

export function CardRows({ children }: { children: ReactNode }) {
  return <div className="divide-y *:px-4 *:py-1.5">{children}</div>;
}

export function CardRowSkeleton() {
  return (
    <SettingsRowFrame label={<SkeletonBar width="w-24" />}>
      <SkeletonBar width="w-20" />
    </SettingsRowFrame>
  );
}

export function SkeletonBar({ width }: { width: string }) {
  return (
    <div className={cn('h-4', width)}>
      <Skeleton fill />
    </div>
  );
}

export function CardListSkeleton({
  count,
  rows,
  band = <SkeletonBar width="w-24" />,
  pagination = true,
}: {
  count: number;
  rows: number;
  band?: ReactNode;
  pagination?: boolean;
}) {
  const cards = Array.from({ length: count }, (_, index) => index);
  const details = Array.from({ length: rows }, (_, index) => index);
  return (
    <CardList footer={pagination && <DataTablePaginationSkeleton />}>
      {cards.map((id) => (
        <CardListItem key={id}>
          <CardBand>{band}</CardBand>
          <CardRows>
            {details.map((id) => (
              <CardRowSkeleton key={id} />
            ))}
          </CardRows>
        </CardListItem>
      ))}
    </CardList>
  );
}
