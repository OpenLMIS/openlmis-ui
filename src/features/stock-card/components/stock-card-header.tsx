import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import { Skeleton } from '@/components/ui/skeleton';
import { stockCardProductName } from '@/features/stock-card/lib/card-lines';
import type { StockCard } from '@/features/stock-card/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 py-2 @2xl/main:flex-col @2xl/main:justify-start @2xl/main:gap-1 @2xl/main:py-0">
      <dt className="shrink-0 text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium text-sm @2xl/main:text-start">
        <bdi>{children}</bdi>
      </dd>
    </div>
  );
}

function HeaderFrame({ product, children }: { product: ReactNode; children: ReactNode }) {
  const heading = useId();
  return (
    <section
      aria-labelledby={heading}
      className="flex flex-col overflow-hidden rounded-xl border bg-card @2xl/main:flex-row"
    >
      <h2
        className="flex items-center bg-muted px-4 py-3 font-semibold text-sm @2xl/main:max-w-64"
        id={heading}
      >
        {product}
      </h2>
      <div className="flex flex-1 items-center px-4 py-1 @2xl/main:py-3">{children}</div>
    </section>
  );
}

export function StockCardHeader({ card, unit }: { card: StockCard; unit: QuantityUnit }) {
  const { t, i18n } = useTranslation();
  const packSize = card.orderable.netContent;
  return (
    <HeaderFrame product={<bdi>{stockCardProductName(card.orderable)}</bdi>}>
      <dl className="flex w-full flex-col divide-y @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:gap-x-8 @2xl/main:gap-y-3 @2xl/main:divide-y-0">
        <Detail label={t('stock-card.product-code')}>{orEmpty(card.orderable.productCode)}</Detail>
        <Detail label={t('stock-card.pack-size')}>
          {packSize == null
            ? orEmpty(packSize)
            : new Intl.NumberFormat(i18n.language).format(packSize)}
        </Detail>
        <Detail label={t('stock-card.facility')}>{orEmpty(card.facility.name)}</Detail>
        <Detail label={t('stock-card.program')}>{orEmpty(card.program.name)}</Detail>
        <Detail label={t('stock-card.stock-on-hand')}>
          <span className="tabular-nums" dir="ltr">
            {orEmpty(cardQuantity(card.stockOnHand, packSize, unit, i18n.language))}
          </span>
        </Detail>
        {card.lot && (
          <>
            <Detail label={t('stock-card.lot-number')}>{orEmpty(card.lot.lotCode)}</Detail>
            <Detail label={t('stock-card.expiry-date')}>
              {card.lot.expirationDate
                ? formatDateValue(card.lot.expirationDate, i18n.language)
                : orEmpty(card.lot.expirationDate)}
            </Detail>
          </>
        )}
      </dl>
    </HeaderFrame>
  );
}

export function StockCardHeaderSkeleton() {
  return (
    <div aria-busy>
      <HeaderFrame
        product={
          <div className="h-4 w-32">
            <Skeleton fill />
          </div>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {['code', 'pack', 'facility', 'program', 'balance', 'lot', 'expiry'].map((id) => (
            <div className="flex flex-col gap-2" key={id}>
              <div className="h-3 w-16">
                <Skeleton fill />
              </div>
              <div className="h-5 w-20">
                <Skeleton fill />
              </div>
            </div>
          ))}
        </div>
      </HeaderFrame>
    </div>
  );
}
