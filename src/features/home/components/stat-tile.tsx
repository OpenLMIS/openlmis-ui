import {
  type QueryKey,
  type UseSuspenseQueryOptions,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueryBoundary } from '@/components/query-boundary';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatNumber, WidgetError } from '@/features/home/components/dashboard-parts';

type StatTileProps<TData, TKey extends QueryKey> = {
  label: string;
  icon: ReactNode;
  query: UseSuspenseQueryOptions<TData, Error, TData, TKey>;
  /** Picks the number to show from the query's data. */
  select: (data: TData) => number;
  /** Where the work behind the number is done. */
  action: ReactNode;
};

/** One headline number: what it counts, how many, and where to act on it. */
export function StatTile<TData, TKey extends QueryKey>({
  label,
  icon,
  query,
  select,
  action,
}: StatTileProps<TData, TKey>) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-14 flex-col items-start justify-between gap-1">
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
          <div className="-ms-2.5">{action}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatValue<TData, TKey extends QueryKey>({
  query,
  select,
}: Pick<StatTileProps<TData, TKey>, 'query' | 'select'>) {
  const { data } = useSuspenseQuery(query);
  const format = useFormatNumber();
  return (
    <span className="text-3xl leading-8 font-semibold tracking-tight">{format(select(data))}</span>
  );
}
