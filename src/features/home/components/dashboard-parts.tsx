import { AlertCircleIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Whole numbers in the reader's language, e.g. 1,140 in English. */
export function useFormatNumber() {
  const { i18n } = useTranslation();
  return useMemo(() => new Intl.NumberFormat(i18n.language).format, [i18n.language]);
}

/** A card title with its count in a badge beside it; the count loads on its own. */
export function CountedTitle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <CardTitle>
      <span className="flex items-center gap-2">
        {title}
        <QueryBoundary
          errorComponent={() => null}
          pendingFallback={
            <span className="block h-5 w-8">
              <Skeleton fill shape="circle" />
            </span>
          }
          resetKey={title}
        >
          {children}
        </QueryBoundary>
      </span>
    </CardTitle>
  );
}

export function CountBadge({ count }: { count: number }) {
  const format = useFormatNumber();
  return <Badge variant="secondary">{format(count)}</Badge>;
}

/** What a dashboard card shows when its numbers could not be loaded. */
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
