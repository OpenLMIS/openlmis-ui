import { type QueryKey, type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { AlertCircleIcon } from 'lucide-react';
import { createContext, type ReactNode, use, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function useFormatNumber() {
  const { i18n } = useTranslation();
  return useMemo(() => new Intl.NumberFormat(i18n.language).format, [i18n.language]);
}

/** A placeholder whose size belongs to the layout around it, set by `className`. */
export function Block({ className, shape }: { className: string; shape?: 'circle' }) {
  return (
    <span className={cn('block', className)}>
      <Skeleton fill shape={shape} />
    </span>
  );
}

/** Bumped by Refresh, so every card that failed mounts again and retries. */
const RevisionContext = createContext(0);

export const DashboardRevision = RevisionContext.Provider;

export function useDashboardRevision() {
  return use(RevisionContext);
}

type CountBadgeProps<TData, TKey extends QueryKey> = {
  query: UseQueryOptions<TData, Error, TData, TKey>;
  select: (data: TData) => number;
};

/** A count beside a title; it never throws, so it appears as soon as its card's data does. */
export function CountBadge<TData, TKey extends QueryKey>({
  query,
  select,
}: CountBadgeProps<TData, TKey>) {
  const { data: count, isPending } = useQuery({ ...query, select });
  const format = useFormatNumber();
  if (isPending) return <Block className="h-5 w-8" shape="circle" />;
  if (count === undefined) return null;
  return <Badge variant="secondary">{format(count)}</Badge>;
}

export function WidgetError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="alert">
      <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">{t('home.load-error')}</span>
      <Button onClick={onRetry} size="sm" type="button" variant="outline">
        {t('error.try-again')}
      </Button>
    </div>
  );
}

type CardFrameProps = {
  title: string;
  badge?: ReactNode;
  description: ReactNode;
  children: ReactNode;
};

/** A dashboard card's chrome: title with its count, a line on what it shows, then the body. */
export function CardFrame({ title, badge, description, children }: CardFrameProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            {title}
            {badge}
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type DashboardCardProps = CardFrameProps & {
  /** Names the card's boundary, so a retry resets this card alone. */
  name: string;
  pending: ReactNode;
};

/** A card whose body loads on its own, with a placeholder and a Try Again of its own. */
export function DashboardCard({ name, pending, children, ...frame }: DashboardCardProps) {
  const revision = useDashboardRevision();
  return (
    <CardFrame {...frame}>
      <QueryBoundary
        errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
        pendingFallback={pending}
        resetKey={`${name}:${revision}`}
      >
        {children}
      </QueryBoundary>
    </CardFrame>
  );
}

/** A wide card beside a narrow one when there is room, stacked otherwise; each stretches to the row. */
export function DashboardRow({ wide, narrow }: { wide?: ReactNode; narrow?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-3">
      {wide && <div className="grid @4xl/main:col-span-2">{wide}</div>}
      {narrow && <div className="grid">{narrow}</div>}
    </div>
  );
}
