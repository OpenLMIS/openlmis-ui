import {
  type QueryKey,
  type UseSuspenseQueryOptions,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Children, type ReactNode } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Block,
  useDashboardRevision,
  useFormatNumber,
  WidgetError,
} from '@/features/home/components/dashboard-parts';
import { cn } from '@/lib/utils';

/** As many columns as there are stats, so a user with fewer rights never sees an empty cell. */
const COLUMNS = [
  'grid-cols-1',
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-1 @2xl/main:grid-cols-3',
  'grid-cols-2 @4xl/main:grid-cols-4',
] as const;

/** One panel of headline numbers, split by hairlines; the gaps show the border colour beneath. */
export function StatStrip({ children }: { children: ReactNode }) {
  const count = Math.min(Children.toArray(children).length, COLUMNS.length - 1);
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

function StatCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const VALUE_PENDING = <Block className="h-8 w-16 py-1" />;

export function StatSkeleton({ label }: { label: string }) {
  return <StatCell label={label}>{VALUE_PENDING}</StatCell>;
}

type StatProps<TData, TKey extends QueryKey> = {
  label: string;
  query: UseSuspenseQueryOptions<TData, Error, TData, TKey>;
  /** Picks the number from the query's data; the data itself when it already is one. */
  select?: (data: TData) => number;
};

export function Stat<TData, TKey extends QueryKey>({
  label,
  query,
  select,
}: StatProps<TData, TKey>) {
  const revision = useDashboardRevision();
  return (
    <StatCell label={label}>
      <QueryBoundary
        errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
        pendingFallback={VALUE_PENDING}
        resetKey={`${JSON.stringify(query.queryKey)}:${revision}`}
      >
        <StatValue query={query} select={select} />
      </QueryBoundary>
    </StatCell>
  );
}

function StatValue<TData, TKey extends QueryKey>({
  query,
  select = (data) => data as number,
}: Pick<StatProps<TData, TKey>, 'query' | 'select'>) {
  const { data } = useSuspenseQuery(query);
  const format = useFormatNumber();
  return (
    <span className="text-2xl leading-8 font-semibold tracking-tight">{format(select(data))}</span>
  );
}
