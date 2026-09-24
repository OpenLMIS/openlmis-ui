import {
  type QueryKey,
  type UseSuspenseQueryOptions,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatNumber, WidgetError } from '@/features/home/components/dashboard-parts';
import { cn } from '@/lib/utils';

/** As many columns as there are stats, so a user with fewer rights never sees an empty cell. */
const COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-1 @2xl/main:grid-cols-3',
  4: 'grid-cols-2 @4xl/main:grid-cols-4',
} as const;

/** One panel of headline numbers, split by hairlines; the gaps show the border colour beneath. */
export function StatStrip({ count, children }: { count: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10',
        COLUMNS[count],
      )}
    >
      {children}
    </div>
  );
}

type StatProps<TData, TKey extends QueryKey> = {
  label: string;
  query: UseSuspenseQueryOptions<TData, Error, TData, TKey>;
  /** Picks the number to show from the query's data. */
  select: (data: TData) => number;
};

/** One headline number and what it counts; the number loads on its own. */
export function Stat<TData, TKey extends QueryKey>({
  label,
  query,
  select,
}: StatProps<TData, TKey>) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <QueryBoundary
        errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
        pendingFallback={
          <div className="h-8 w-16 py-1">
            <Skeleton fill />
          </div>
        }
        resetKey={JSON.stringify(query.queryKey)}
      >
        <StatValue query={query} select={select} />
      </QueryBoundary>
    </div>
  );
}

function StatValue<TData, TKey extends QueryKey>({
  query,
  select,
}: Pick<StatProps<TData, TKey>, 'query' | 'select'>) {
  const { data } = useSuspenseQuery(query);
  const format = useFormatNumber();
  return (
    <span className="text-2xl leading-8 font-semibold tracking-tight">{format(select(data))}</span>
  );
}
