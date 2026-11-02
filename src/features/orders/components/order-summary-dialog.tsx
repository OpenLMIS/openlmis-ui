import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { dataTableFeatures } from '@/components/data-table/data-table';
import { DialogTable } from '@/components/display/dialog-table';
import { FormDialogBody } from '@/components/form-dialog/form-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cachedOrderBalance, orderStockOnHandOptions } from '@/features/orders/api/queries';
import { PackHint, productName } from '@/features/orders/components/order-lines';
import { OrderStockBalance, OrderStockError } from '@/features/orders/components/order-stock';
import type { OrderSnapshot } from '@/features/orders/lib/order-actions';
import type { DraftLine } from '@/features/orders/lib/order-draft';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { productQuantity, type QuantityUnit } from '@/lib/quantity';
import { toWholeNumber } from '@/lib/whole-number';

type SummaryRow = { heading?: string; line?: DraftLine; stock?: number | null; loading?: boolean };
export function OrderSummaryDialog({
  open,
  onOpenChange,
  snapshots,
  unit,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshots: OrderSnapshot[];
  unit: QuantityUnit;
  onConfirm: () => void;
  pending: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useDialogCardLayout('2xl');
  const client = useQueryClient();
  const stocks = useQueries({
    queries: snapshots.map((snapshot) => ({
      ...orderStockOnHandOptions({
        programId: snapshot.order.program.id,
        facilityId: snapshot.order.requestingFacility.id,
        orderableIds: snapshot.lines.map((line) => line.product.id),
      }),
      enabled: open && snapshot.lines.length > 0,
      retry: false,
    })),
  });
  const rows: SummaryRow[] = snapshots.flatMap((snapshot, index) => [
    { heading: snapshot.order.requestingFacility.name ?? snapshot.order.id },
    ...snapshot.lines.map((line) => ({
      line,
      stock:
        stocks[index]?.data?.find((item) => item.orderable.id === line.product.id)?.stockOnHand ??
        cachedOrderBalance(
          client,
          {
            programId: snapshot.order.program.id,
            facilityId: snapshot.order.requestingFacility.id,
            orderableIds: [],
          },
          line.product.id,
        ),
      loading: stocks[index]?.isPending,
    })),
  ]);
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns: [
      {
        id: 'code',
        header: t('orders.edit.product-code'),
        meta: { label: t('orders.edit.product-code') },
        cell: ({ row }) => row.original.line?.product.productCode,
      },
      {
        id: 'product',
        header: t('orders.edit.product'),
        meta: { label: t('orders.edit.product') },
        cell: ({ row }) => (row.original.line ? productName(row.original.line) : null),
      },
      {
        id: 'size',
        header: t('orders.edit.pack-size'),
        meta: { label: t('orders.edit.pack-size') },
        cell: ({ row }) => row.original.line?.product.netContent,
      },
      {
        id: 'stock',
        header: t('orders.edit.stock-on-hand'),
        meta: { label: t('orders.edit.stock-on-hand') },
        cell: ({ row }) =>
          row.original.line ? (
            <OrderStockBalance
              value={row.original.stock}
              loading={!!row.original.loading}
              netContent={row.original.line.product.netContent}
              unit={unit}
            />
          ) : null,
      },
      {
        id: 'quantity',
        header: t('orders.edit.quantity'),
        meta: { label: t('orders.edit.quantity') },
        cell: ({ row }) => {
          const line = row.original.line;
          return line ? (
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
          ) : null;
        },
      },
    ],
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent size="2xl" layout="scroll" showCloseButton={!pending}>
        <div ref={measure} />
        <DialogHeader>
          <DialogTitle>{t('orders.edit.summary-title')}</DialogTitle>
          <DialogDescription>{t('orders.edit.summary-description')}</DialogDescription>
        </DialogHeader>
        <FormDialogBody>
          {stocks.map(
            (stock, index) =>
              stock.isError && (
                <OrderStockError
                  key={snapshots[index].order.id}
                  error={stock.error}
                  reset={() => stock.refetch()}
                />
              ),
          )}
          <DialogTable
            table={table}
            cards={cards}
            heading={(row) => row.heading}
            title="product"
            empty={t('orders.create.empty')}
            layout="auto"
          />
        </FormDialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            {t('orders.edit.cancel')}
          </DialogClose>
          <Button disabled={pending} onClick={onConfirm}>
            {t('orders.edit.summary-confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
