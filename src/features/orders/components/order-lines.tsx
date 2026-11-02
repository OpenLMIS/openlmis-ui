import { useQuery } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/display/card-actions';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { QuantityHeaderSizer } from '@/components/display/quantity-header-sizer';
import { SettingsItem } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { orderStockOnHandOptions } from '@/features/orders/api/queries';
import { type DraftLine, validQuantity } from '@/features/orders/lib/order-draft';
import type { Order } from '@/features/orders/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty } from '@/lib/empty-value';
import { packsToShip, productQuantity, type QuantityUnit } from '@/lib/quantity';
import { toWholeNumber } from '@/lib/whole-number';

export function productName(line: DraftLine) {
  const product = line.product;
  return `${product.fullProductName ?? product.productCode}${product.dispensable?.displayUnit ? ` - ${product.dispensable.displayUnit}` : ''} (${product.productCode})`;
}
export function PackHint({ line }: { line: DraftLine }) {
  const { t } = useTranslation();
  if (
    !validQuantity(line.quantity) ||
    !toWholeNumber(line.quantity.doses) ||
    !line.product.netContent ||
    line.product.netContent === 1
  )
    return null;
  const packs = packsToShip(
    toWholeNumber(line.quantity.doses),
    line.product.netContent,
    line.product.packRoundingThreshold ?? 0,
    line.product.roundToZero ?? false,
  );
  return (
    <span className="block text-muted-foreground text-xs">
      {t('orders.edit.packs-hint', { packs, doses: packs * line.product.netContent })}
    </span>
  );
}
export function OrderLines({
  order,
  lines,
  unit,
  disabled,
  quantity,
  onRemove,
  readOnly = false,
}: {
  order: Order;
  lines: readonly DraftLine[];
  unit: QuantityUnit;
  disabled: boolean;
  quantity?: (line: DraftLine, index: number, cards: boolean) => ReactNode;
  onRemove?: (key: string) => void;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const stock = useQuery({
    ...orderStockOnHandOptions({
      programId: order.program.id,
      facilityId: order.requestingFacility.id,
      orderableIds: lines.map((line) => line.product.id),
    }),
    retry: false,
  });
  const balance = (line: DraftLine) => {
    if (stock.isPending)
      return (
        <span className="inline-block h-4 w-12">
          <Skeleton fill />
        </span>
      );
    const value = stock.data?.find((item) => item.orderable.id === line.product.id)?.stockOnHand;
    return value == null
      ? ''
      : productQuantity(value, [value], line.product.netContent, unit, i18n.language);
  };
  const values = (line: DraftLine) => [
    { key: 'pack-size' as const, value: line.product.netContent },
    { key: 'stock-on-hand' as const, value: balance(line) },
  ];
  const qty = (line: DraftLine, index: number) =>
    readOnly ? (
      <>
        {productQuantity(
          toWholeNumber(line.quantity.doses),
          [toWholeNumber(line.quantity.doses)],
          line.product.netContent,
          unit,
          i18n.language,
        )}
        <PackHint line={line} />
      </>
    ) : (
      <>
        {quantity?.(line, index, cards)}
        <PackHint line={line} />
      </>
    );
  return (
    <div ref={measure}>
      {cards ? (
        <CardList empty={!lines.length && t('orders.create.empty')}>
          {lines.map((line, index) => (
            <CardListItem
              key={line.key}
              tone={!validQuantity(line.quantity) ? 'invalid' : undefined}
            >
              <CardBand>
                <span className="min-w-0 break-words">{productName(line)}</span>
                {!readOnly && (
                  <CardActions
                    label={t('orders.edit.actions')}
                    actions={[
                      {
                        id: 'remove',
                        icon: <Trash2Icon />,
                        label: t('orders.edit.remove-line', { product: productName(line) }),
                        destructive: true,
                        disabled,
                        onSelect: () => onRemove?.(line.key),
                      },
                    ]}
                  />
                )}
              </CardBand>
              <CardRows>
                {values(line).map((item) => (
                  <SettingsItem key={item.key} label={t(`orders.edit.${item.key}`)}>
                    {orEmpty(item.value)}
                  </SettingsItem>
                ))}
                <CardControlRow
                  label={t('orders.edit.quantity')}
                  width={unit === 'PACKS' ? 'wide' : undefined}
                >
                  {qty(line, index)}
                </CardControlRow>
              </CardRows>
            </CardListItem>
          ))}
        </CardList>
      ) : (
        <Table scroll="both" layout="auto">
          <TableHeader>
            <TableRow>
              <TableHead>{t('orders.edit.product-code')}</TableHead>
              <TableHead>{t('orders.edit.product')}</TableHead>
              <TableHead>{t('orders.edit.pack-size')}</TableHead>
              <TableHead>{t('orders.edit.stock-on-hand')}</TableHead>
              <TableHead>
                <QuantityHeaderSizer unit={unit} />
                {t('orders.edit.quantity')}
              </TableHead>
              {!readOnly && <TableHead width="icon">{t('orders.edit.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lines.length && (
              <TableRow>
                <TableCell colSpan={6}>{t('orders.create.empty')}</TableCell>
              </TableRow>
            )}
            {lines.map((line, index) => (
              <TableRow key={line.key} aria-invalid={!validQuantity(line.quantity) || undefined}>
                <TableCell>{line.product.productCode}</TableCell>
                <TableCell>
                  <span className="block min-w-40 whitespace-normal">
                    {line.product.fullProductName}
                  </span>
                </TableCell>
                <TableCell>{line.product.netContent}</TableCell>
                <TableCell>{balance(line)}</TableCell>
                <TableCell>{qty(line, index)}</TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('orders.edit.remove-line', { product: productName(line) })}
                      disabled={disabled}
                      onClick={() => onRemove?.(line.key)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
