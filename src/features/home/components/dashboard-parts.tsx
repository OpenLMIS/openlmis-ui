import { AlertCircleIcon, ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { legacyUrl } from '@/lib/legacy-url';

/** Whole numbers in the reader's language, e.g. 1,140 in English. */
export function useFormatNumber() {
  const { i18n } = useTranslation();
  return useMemo(() => new Intl.NumberFormat(i18n.language).format, [i18n.language]);
}

/** A link to a page that still lives in the legacy UI, styled as a quiet call to action. */
export function LegacyLink({ route, children }: { route: string; children: ReactNode }) {
  return (
    <Button nativeButton={false} render={<a href={legacyUrl(route)} />} size="sm" variant="link">
      {children}
      <ChevronRightIcon className="rtl:rotate-180" data-icon="inline-end" />
    </Button>
  );
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
