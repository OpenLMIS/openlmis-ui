import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { ClipboardPenLineIcon, Trash2Icon } from 'lucide-react';
import { memo, type ReactNode, useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardActions } from '@/components/display/card-actions';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { QuantityHeaderSizer } from '@/components/display/quantity-header-sizer';
import { TableCardsSkeleton } from '@/components/display/table-cards';
import { SettingsItem } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cachedOrderBalance, orderStockOnHandOptions } from '@/features/orders/api/queries';
import { OrderStockBalance, OrderStockError } from '@/features/orders/components/order-stock';
import { useRemovalFocus } from '@/features/orders/hooks/use-removal-focus';
import { type DraftLine, validQuantity } from '@/features/orders/lib/order-draft';
import type { Order } from '@/features/orders/lib/types';
import { productLabel } from '@/features/reference-data/lib/products';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty } from '@/lib/empty-value';
import { packsToShip, type QuantityUnit } from '@/lib/quantity';
import { toWholeNumber } from '@/lib/whole-number';

export function productName(line: DraftLine) {
  const product = line.product;
  return `${productLabel(product)} (${product.productCode})`;
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
}: {
  order: Order;
  lines: readonly DraftLine[];
  unit: QuantityUnit;
  disabled: boolean;
  quantity: (line: DraftLine, index: number, cards: boolean) => ReactNode;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const filter = {
    programId: order.program.id,
    facilityId: order.requestingFacility.id,
    orderableIds: lines.map((line) => line.product.id),
  };
  const stock = useQuery(orderStockOnHandOptions(filter));
  const focus = useRemovalFocus(
    lines.map((line) => line.key),
    () => document.getElementById('order-product'),
  );
  const removal = useRef({ focus, onRemove });
  useLayoutEffect(() => {
    removal.current = { focus, onRemove };
  });
  const handleRemove = useCallback((key: string) => {
    removal.current.focus.removing(key);
    removal.current.onRemove(key);
  }, []);
  const row = (line: DraftLine, index: number) => (
    <OrderLine
      key={line.key}
      line={line}
      index={index}
      cards={cards}
      unit={unit}
      disabled={disabled}
      quantity={quantity}
      onRemove={handleRemove}
      stock={
        stock.data?.find((item) => item.orderable.id === line.product.id)?.stockOnHand ??
        cachedOrderBalance(client, filter, line.product.id)
      }
      loading={stock.isPending && cachedOrderBalance(client, filter, line.product.id) === undefined}
    />
  );
  const empty = (
    <DataTableEmpty
      icon={<ClipboardPenLineIcon />}
      title={t('orders.edit.empty-title')}
      description={t('orders.edit.empty-description')}
    />
  );
  return (
    <div
      ref={(element) => {
        measure(element);
        focus.region.current = element;
      }}
    >
      {stock.isError && <OrderStockError error={stock.error} reset={() => stock.refetch()} />}
      {cards ? (
        <CardList empty={!lines.length && empty}>{lines.map(row)}</CardList>
      ) : (
        <DataTableCard>
          <Table density="compact" layout="auto">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>{t('orders.edit.product-code')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('orders.edit.product')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('orders.edit.pack-size')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('orders.edit.stock-on-hand')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <QuantityHeaderSizer unit={unit} />
                  <DataTableHeaderLabel>{t('orders.edit.quantity')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead width="icon">
                  <DataTableHeaderLabel>{t('orders.edit.actions')}</DataTableHeaderLabel>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!lines.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="whitespace-normal">{empty}</div>
                  </TableCell>
                </TableRow>
              )}
              {lines.map(row)}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}

const OrderLine = memo(function OrderLine({
  line,
  index,
  cards,
  unit,
  disabled,
  quantity,
  onRemove,
  stock,
  loading,
}: {
  line: DraftLine;
  index: number;
  cards: boolean;
  unit: QuantityUnit;
  disabled: boolean;
  quantity: (line: DraftLine, index: number, cards: boolean) => ReactNode;
  onRemove: (key: string) => void;
  stock: number | null | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const balance = (
    <OrderStockBalance
      value={stock}
      loading={loading}
      netContent={line.product.netContent}
      unit={unit}
    />
  );
  const qty = (
    <>
      {quantity(line, index, cards)}
      <PackHint line={line} />
    </>
  );
  return cards ? (
    <CardListItem tone={!validQuantity(line.quantity) ? 'invalid' : undefined}>
      <CardBand>
        <span className="min-w-0 break-words">{productName(line)}</span>
        <div data-removal-control>
          <CardActions
            label={t('orders.edit.actions')}
            actions={[
              {
                id: 'remove',
                icon: <Trash2Icon />,
                label: t('orders.edit.remove-line', { product: productName(line) }),
                destructive: true,
                disabled,
                onSelect: () => onRemove(line.key),
              },
            ]}
          />
        </div>
      </CardBand>
      <CardRows>
        {[
          { key: 'pack-size' as const, value: line.product.netContent },
          { key: 'stock-on-hand' as const, value: balance },
        ].map((item) => (
          <SettingsItem key={item.key} label={t(`orders.edit.${item.key}`)}>
            {orEmpty(item.value)}
          </SettingsItem>
        ))}
        <CardControlRow
          label={t('orders.edit.quantity')}
          width={unit === 'PACKS' ? 'wide' : undefined}
        >
          {qty}
        </CardControlRow>
      </CardRows>
    </CardListItem>
  ) : (
    <TableRow aria-invalid={!validQuantity(line.quantity) || undefined}>
      <TableCell>{line.product.productCode}</TableCell>
      <TableCell>
        <span className="block min-w-40 whitespace-normal">{line.product.fullProductName}</span>
      </TableCell>
      <TableCell>{line.product.netContent}</TableCell>
      <TableCell>{balance}</TableCell>
      <TableCell>{qty}</TableCell>
      <TableCell>
        <Button
          data-removal-control
          variant="ghost"
          size="icon-sm"
          aria-label={t('orders.edit.remove-line', { product: productName(line) })}
          disabled={disabled}
          onClick={() => onRemove(line.key)}
        >
          <Trash2Icon />
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function OrderLinesSkeleton() {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const table = useTable({
    features: dataTableFeatures,
    data: [],
    columns: (
      ['product-code', 'product', 'pack-size', 'stock-on-hand', 'quantity', 'actions'] as const
    ).map((key) => ({
      id: key,
      header: t(`orders.edit.${key}`),
      meta: {
        label: t(`orders.edit.${key}`),
        skeleton: key === 'quantity' || key === 'actions' ? ('control' as const) : undefined,
      },
    })),
  });
  return (
    <div ref={measure}>
      {cards ? (
        <TableCardsSkeleton table={table} title="product" rowCount={2} pagination={false} />
      ) : (
        <DataTableSkeleton
          table={table}
          rowCount={2}
          pagination="none"
          density="compact"
          layout="auto"
        />
      )}
    </div>
  );
}
