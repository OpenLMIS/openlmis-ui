import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { stockCardProductName } from '@/features/stock-card/lib/card-lines';
import type { StockCard } from '@/features/stock-card/lib/types';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-words text-sm">
        <bdi>{children}</bdi>
      </dd>
    </div>
  );
}

export function StockCardHeader({ card, unit }: { card: StockCard; unit: QuantityUnit }) {
  const { t, i18n } = useTranslation();
  const heading = useId();
  return (
    <section aria-labelledby={heading}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="break-words" id={heading}>
              {stockCardProductName(card.orderable)}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 @sm/main:grid-cols-2 @3xl/main:grid-cols-4">
            <Detail label={t('stock-card.product-code')}>{card.orderable.productCode}</Detail>
            <Detail label={t('stock-card.pack-size')}>
              {card.orderable.netContent == null
                ? ''
                : new Intl.NumberFormat(i18n.language).format(card.orderable.netContent)}
            </Detail>
            <Detail label={t('stock-card.facility')}>{card.facility.name}</Detail>
            <Detail label={t('stock-card.program')}>{card.program.name}</Detail>
            <Detail label={t('stock-card.stock-on-hand')}>
              <span className="tabular-nums" dir="ltr">
                {cardQuantity(card.stockOnHand, card.orderable.netContent, unit, i18n.language)}
              </span>
            </Detail>
            {card.lot && (
              <>
                <Detail label={t('stock-card.lot-number')}>{card.lot.lotCode}</Detail>
                <Detail label={t('stock-card.expiry-date')}>
                  {card.lot.expirationDate
                    ? formatDateValue(card.lot.expirationDate, i18n.language)
                    : ''}
                </Detail>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

export function StockCardHeaderSkeleton() {
  return (
    <div aria-busy>
      <Card>
        <CardHeader>
          <div className="h-5 w-72 max-w-full">
            <Skeleton fill />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 @sm/main:grid-cols-2 @3xl/main:grid-cols-4">
            {['code', 'pack', 'facility', 'program', 'balance', 'lot', 'expiry'].map((id) => (
              <div className="flex flex-col gap-2" key={id}>
                <div className="h-3 w-20">
                  <Skeleton fill />
                </div>
                <div className="h-5 w-3/4">
                  <Skeleton fill />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
