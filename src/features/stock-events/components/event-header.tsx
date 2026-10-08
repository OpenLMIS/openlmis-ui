import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTimeValue } from '@/components/form/date-value';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { orEmpty } from '@/lib/empty-value';

const DETAIL_CLASS =
  'flex min-w-0 items-baseline justify-between gap-4 py-2 @2xl/main:flex-col @2xl/main:justify-start @2xl/main:gap-1 @2xl/main:py-0';
const FIELDS_CLASS =
  'flex w-full flex-col divide-y @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:gap-x-8 @2xl/main:gap-y-3 @2xl/main:divide-y-0';
const TYPE_KEYS = {
  ISSUE: 'stock-event.type-issue',
  RECEIVE: 'stock-event.type-receive',
  ADJUSTMENT: 'stock-event.type-adjustment',
} as const;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={DETAIL_CLASS}>
      <dt className="shrink-0 text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium text-sm @2xl/main:text-start">
        <bdi>{children}</bdi>
      </dd>
    </div>
  );
}

function HeaderFrame({ document, children }: { document?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const heading = useId();
  return (
    <section
      aria-labelledby={document ? heading : undefined}
      aria-label={document ? undefined : t('stock-event.title')}
      className="flex flex-col overflow-hidden rounded-xl border bg-card @2xl/main:flex-row"
    >
      {document && (
        <h2
          className="flex flex-col justify-center gap-1 bg-muted px-4 py-3 font-semibold text-sm @2xl/main:max-w-64"
          id={heading}
        >
          <span className="text-muted-foreground text-xs">{t('stock-event.document-number')}</span>
          <bdi className="break-words">{document}</bdi>
        </h2>
      )}
      <div className="flex flex-1 items-center px-4 py-1 @2xl/main:py-3">{children}</div>
    </section>
  );
}

export function EventHeader({ event }: { event: StockEventSummary }) {
  const { t, i18n } = useTranslation();
  return (
    <HeaderFrame document={event.documentNumber || undefined}>
      <dl className={FIELDS_CLASS}>
        <Detail label={t('stock-event.type')}>
          {event.type ? t(TYPE_KEYS[event.type]) : orEmpty(event.type)}
        </Detail>
        <Detail label={t('stock-event.date')}>
          {orEmpty(formatDateTimeValue(event.processedDate ?? '', i18n.language))}
        </Detail>
        <Detail label={t('stock-event.performed-by')}>{orEmpty(event.username)}</Detail>
        <Detail label={t('stock-event.signature')}>{orEmpty(event.signature)}</Detail>
      </dl>
    </HeaderFrame>
  );
}

const SKELETON_FIELDS = ['type', 'date', 'performedBy', 'signature'];

export function EventHeaderSkeleton() {
  return (
    <div aria-busy>
      <HeaderFrame
        document={
          <div className="h-4 w-32">
            <Skeleton fill />
          </div>
        }
      >
        <div className={FIELDS_CLASS}>
          {SKELETON_FIELDS.map((id) => (
            <div className={DETAIL_CLASS} key={id}>
              <div className="flex h-4 items-center">
                <div className="h-3 w-16">
                  <Skeleton fill />
                </div>
              </div>
              <div className="flex h-5 items-center">
                <div className="h-4 w-28">
                  <Skeleton fill />
                </div>
              </div>
            </div>
          ))}
        </div>
      </HeaderFrame>
    </div>
  );
}
