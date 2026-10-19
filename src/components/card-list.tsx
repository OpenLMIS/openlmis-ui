import { ChevronDownIcon } from 'lucide-react';
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

export function CardListItem({
  surface = 'raised',
  children,
}: {
  surface?: 'raised' | 'flat';
  children: ReactNode;
}) {
  const content = <div className="divide-y">{children}</div>;
  return (
    <li className="scroll-mt-page-start">
      {surface === 'flat' ? (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">{content}</div>
      ) : (
        <DataTableCard>{content}</DataTableCard>
      )}
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
  action,
  children,
}: {
  htmlFor: string;
  selected: boolean;
  disabled?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const tint = selected ? 'bg-primary/5' : 'bg-muted/50';
  const band = (
    <label
      htmlFor={htmlFor}
      className={cn(
        'flex min-h-10 items-center gap-3 px-4 py-1.5 font-semibold text-sm',
        action ? 'min-w-0 flex-1' : ['transition-colors', tint],
        !disabled && 'cursor-pointer',
      )}
    >
      {children}
    </label>
  );
  if (!action) return band;
  return (
    <div className={cn('flex items-center pe-4 transition-colors', tint)}>
      {band}
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function CardToggleBand({
  open,
  onToggle,
  controls,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-controls={controls}
      aria-expanded={open}
      className="flex min-h-10 w-full items-center gap-3 bg-muted/50 px-4 py-1.5 text-start font-semibold text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={onToggle}
      type="button"
    >
      <ChevronDownIcon
        aria-hidden
        className={cn('size-4 shrink-0 text-muted-foreground', !open && '-rotate-90 rtl:rotate-90')}
      />
      {children}
    </button>
  );
}

export function CardRows({ children }: { children: ReactNode }) {
  return <div className="divide-y *:px-4 *:py-1.5">{children}</div>;
}

export function CardControlRow({
  label,
  width = 'half',
  children,
}: {
  label: ReactNode;
  width?: 'half' | 'wide' | 'fit';
  children: ReactNode;
}) {
  return (
    <SettingsRowFrame
      value={width === 'half' ? 'control' : width}
      align="center"
      label={<span className="text-sm">{label}</span>}
    >
      {children}
    </SettingsRowFrame>
  );
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
  surface = 'raised',
}: {
  count: number;
  rows: number;
  band?: ReactNode;
  pagination?: boolean;
  surface?: 'raised' | 'flat';
}) {
  const cards = Array.from({ length: count }, (_, index) => index);
  const details = Array.from({ length: rows }, (_, index) => index);
  return (
    <CardList footer={pagination && <DataTablePaginationSkeleton />}>
      {cards.map((id) => (
        <CardListItem key={id} surface={surface}>
          <CardBand>{band}</CardBand>
          {rows > 0 && (
            <CardRows>
              {details.map((id) => (
                <CardRowSkeleton key={id} />
              ))}
            </CardRows>
          )}
        </CardListItem>
      ))}
    </CardList>
  );
}
