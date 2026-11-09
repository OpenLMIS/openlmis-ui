import { defaultRangeExtractor, useWindowVirtualizer } from '@tanstack/react-virtual';
import type { ParseKeys } from 'i18next';
import { Trash2Icon } from 'lucide-react';
import {
  type ComponentProps,
  type CSSProperties,
  Fragment,
  memo,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/display/card-actions';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
import { productLabel } from '@/features/reference-data/lib/products';
import {
  type GridRow,
  RequisitionLineCell,
} from '@/features/requisitions/components/requisition-grid';
import { useLiveGridLine } from '@/features/requisitions/hooks/use-live-grid-line';
import { gridRowTone } from '@/features/requisitions/lib/grid-row-tone';
import type { GridColumn } from '@/features/requisitions/lib/template';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';

export const cardControlWidth = (column: GridColumn, unit: QuantityUnit) =>
  column.kind === 'skip' || column.kind === 'adjustments'
    ? 'fit'
    : column.convertsToPacks && unit === 'PACKS'
      ? 'wide'
      : 'half';

export function RequisitionEditCards({
  rows,
  requisitionId,
  supplyingStock,
  columns,
  context,
  editing,
  errors,
  footer,
  empty,
  listRef,
  remove,
  unit,
  pending,
}: {
  pending: boolean;
  supplyingStock: boolean;
  rows: GridRow[];
  requisitionId: string;
  columns: GridColumn[];
  context: ComponentProps<typeof RequisitionLineCell>['context'];
  editing: NonNullable<ComponentProps<typeof RequisitionLineCell>['editing']>;
  errors: Record<string, Record<string, ParseKeys>>;
  footer: ReactNode;
  empty: ReactNode;
  listRef: Ref<HTMLUListElement>;
  remove?: (id: string) => void;
  unit: QuantityUnit;
}) {
  const list = useRef<HTMLUListElement | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const virtual = rows.length > 30;
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    enabled: virtual,
    getItemKey: (index) => rows[index].id,
    estimateSize: (index) => (rows[index].category !== undefined ? 40 : 640),
    overscan: 2,
    gap: 16,
    scrollMargin: list.current ? list.current.getBoundingClientRect().top + window.scrollY : 0,
    rangeExtractor: (range) => {
      const indices = new Set(defaultRangeExtractor(range));
      if (focused !== null)
        for (const index of [focused - 1, focused, focused + 1])
          if (index >= 0 && index < rows.length) indices.add(index);
      return [...indices].sort((a, b) => a - b);
    },
  });
  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ requisitionId: string; lineId: string }>).detail;
      if (!virtual || detail.requisitionId !== requisitionId) return;
      const index = rows.findIndex((row) => row.id === detail.lineId);
      if (index < 0) return;
      setFocused(index);
      virtualizer.scrollToIndex(index, { align: 'center' });
    };
    document.addEventListener('requisition-line-focus', reveal);
    return () => document.removeEventListener('requisition-line-focus', reveal);
  }, [virtual, requisitionId, rows, virtualizer]);
  const items = virtual
    ? virtualizer.getVirtualItems()
    : rows.map((_, index) => ({ index, start: 0, end: 0, key: rows[index].id }));
  const margin = virtualizer.options.scrollMargin ?? 0;
  const padding = virtual
    ? {
        start: 0,
        end: Math.max(0, virtualizer.getTotalSize() - (items.at(-1)?.end ?? margin) + margin),
      }
    : undefined;
  let previousEnd = margin - 16;
  return (
    <div
      onFocusCapture={(event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>('li[data-index]');
        if (item) setFocused(Number(item.dataset.index));
      }}
    >
      <CardList
        padding={padding}
        empty={!rows.length && empty}
        footer={footer}
        listRef={(element) => {
          list.current = element;
          if (typeof listRef === 'function') listRef(element);
          else if (listRef) listRef.current = element;
        }}
      >
        {items.map((item) => {
          const row = rows[item.index];
          const gap = virtual ? Math.max(0, item.start - previousEnd - 16) : 0;
          previousEnd = item.end;
          return (
            <Fragment key={row.id}>
              {row.category !== undefined ? (
                <li
                  key={row.id}
                  className="mt-(--card-gap)"
                  style={{ '--card-gap': `${gap}px` } as CSSProperties}
                  aria-posinset={item.index + 1}
                  aria-setsize={rows.length}
                >
                  <h2 className="px-1 pt-2 font-semibold text-base">
                    <bdi>{row.category}</bdi>
                  </h2>
                </li>
              ) : (
                row.model && (
                  <RequisitionEditCard
                    key={row.id}
                    virtual={
                      virtual ? { gap, position: item.index + 1, size: rows.length } : undefined
                    }
                    rowIndex={virtual ? item.index : undefined}
                    measure={virtual ? virtualizer.measureElement : undefined}
                    model={row.model}
                    columns={columns}
                    context={context}
                    editing={editing}
                    errors={errors[row.id]}
                    supplyingStock={supplyingStock}
                    remove={remove}
                    pending={pending}
                    unit={unit}
                  />
                )
              )}
            </Fragment>
          );
        })}
      </CardList>
    </div>
  );
}

type EditCardProps = ComponentProps<typeof RequisitionEditCardView>;
const RequisitionEditCard = memo(function RequisitionEditCard(props: EditCardProps) {
  return props.editing.calculation ? (
    <LiveEditCard {...props} />
  ) : (
    <RequisitionEditCardView {...props} />
  );
});
function LiveEditCard(props: EditCardProps) {
  const live = useLiveGridLine(props.model, props.editing);
  return <RequisitionEditCardView {...props} model={live.model} errors={live.errors} />;
}
const RequisitionEditCardView = memo(function RequisitionEditCardView({
  rowIndex,
  virtual,
  measure,
  model,
  columns,
  context,
  editing,
  errors,
  supplyingStock,
  remove,
  pending,
  unit,
}: {
  virtual?: { gap: number; position: number; size: number };
  rowIndex?: number;
  measure?: (element: HTMLLIElement | null) => void;
  model: NonNullable<GridRow['model']>;
  columns: GridColumn[];
  context: ComponentProps<typeof RequisitionLineCell>['context'];
  editing: NonNullable<ComponentProps<typeof RequisitionLineCell>['editing']>;
  errors?: Record<string, ParseKeys>;
  supplyingStock: boolean;
  remove?: (id: string) => void;
  pending: boolean;
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  return (
    <CardListItem
      virtual={virtual}
      itemRef={
        measure
          ? (element) => {
              if (element) element.dataset.index = String(rowIndex);
              measure(element);
            }
          : undefined
      }
      tone={errors ? 'invalid' : gridRowTone({ model }, supplyingStock)}
    >
      <CardBand>
        <bdi>
          {model.product
            ? `${productLabel(model.product)} (${model.product.productCode})`
            : EMPTY_VALUE}
        </bdi>
        {remove && (
          <CardActions
            label={t('card-actions.actions-for', {
              name: model.product?.fullProductName ?? '',
            })}
            actions={[
              {
                id: 'remove',
                disabled: pending,
                data: { 'data-requisition-remove': model.line.id },
                label: t('requisitions.edit.remove-product'),
                name: t('requisitions.edit.remove-product-label', {
                  product: model.product?.fullProductName ?? '',
                }),
                icon: <Trash2Icon />,
                destructive: true,
                onSelect: () => remove(model.line.id),
              },
            ]}
          />
        )}
      </CardBand>
      <CardRows>
        {columns
          .filter((c) => c.kind !== 'product')
          .map((column) =>
            editing.editableColumns.includes(column.name) ||
            column.kind === 'skip' ||
            (column.kind === 'adjustments' && !context.stockBased) ? (
              <CardControlRow
                key={column.name}
                label={column.label}
                width={cardControlWidth(column, unit)}
              >
                <RequisitionLineCell
                  column={column}
                  model={model}
                  context={context}
                  editing={editing}
                  shortfall={gridRowTone({ model }, supplyingStock) === 'shortfall'}
                  error={errors?.[column.name]}
                />
              </CardControlRow>
            ) : (
              <SettingsItem key={column.name} label={column.label}>
                <RequisitionLineCell
                  column={column}
                  model={model}
                  context={context}
                  editing={editing}
                  shortfall={gridRowTone({ model }, supplyingStock) === 'shortfall'}
                  error={errors?.[column.name]}
                />
              </SettingsItem>
            ),
          )}
      </CardRows>
    </CardListItem>
  );
});
