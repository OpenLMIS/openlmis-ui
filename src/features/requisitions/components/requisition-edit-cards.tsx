import { Trash2Icon } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import { CardBand, CardControlRow, CardList, CardListItem, CardRows } from '@/components/card-list';
import { SettingsItem } from '@/components/form/settings-list';
import { productLabel } from '@/features/reference-data/lib/products';
import type { GridRow } from '@/features/requisitions/components/requisition-grid';
import type { GridColumn } from '@/features/requisitions/lib/template';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';

export function RequisitionEditCards({
  rows,
  columns,
  renderCell,
  footer,
  empty,
  listRef,
  remove,
  invalid,
  unit,
  isControl,
  pending,
}: {
  pending: boolean;
  rows: GridRow[];
  columns: GridColumn[];
  renderCell: (column: GridColumn, row: GridRow) => ReactNode;
  footer: ReactNode;
  empty: ReactNode;
  listRef: Ref<HTMLUListElement>;
  remove?: (id: string) => void;
  invalid: (id: string) => boolean;
  unit: QuantityUnit;
  isControl: (column: GridColumn) => boolean;
}) {
  const { t } = useTranslation();
  return (
    <CardList empty={!rows.length && empty} footer={footer} listRef={listRef}>
      {rows.map((row) =>
        row.category !== undefined ? (
          <li key={row.id}>
            <h2 className="px-1 pt-2 font-semibold text-base">
              <bdi>{row.category}</bdi>
            </h2>
          </li>
        ) : (
          row.model && (
            <CardListItem
              key={row.id}
              tone={invalid(row.id) ? 'invalid' : row.model.line.skipped ? 'skipped' : undefined}
            >
              <CardBand>
                <bdi>
                  {row.model.product
                    ? `${productLabel(row.model.product)} (${row.model.product.productCode})`
                    : EMPTY_VALUE}
                </bdi>
                {remove && (
                  <CardActions
                    label={t('card-actions.actions-for', {
                      name: row.model.product?.fullProductName ?? '',
                    })}
                    actions={[
                      {
                        id: 'remove',
                        disabled: pending,
                        data: { 'data-requisition-remove': row.id },
                        label: t('requisitions.edit.remove-product'),
                        name: `${t('requisitions.edit.remove-product')}: ${row.model.product?.fullProductName}`,
                        icon: <Trash2Icon />,
                        destructive: true,
                        onSelect: () => remove(row.id),
                      },
                    ]}
                  />
                )}
              </CardBand>
              <CardRows>
                {columns
                  .filter((c) => c.kind !== 'product')
                  .map((column) =>
                    isControl(column) ? (
                      <CardControlRow
                        key={column.name}
                        label={column.label}
                        width={column.convertsToPacks && unit === 'PACKS' ? 'wide' : 'half'}
                      >
                        {renderCell(column, row) ?? EMPTY_VALUE}
                      </CardControlRow>
                    ) : (
                      <SettingsItem key={column.name} label={column.label}>
                        {renderCell(column, row) ?? EMPTY_VALUE}
                      </SettingsItem>
                    ),
                  )}
              </CardRows>
            </CardListItem>
          )
        ),
      )}
    </CardList>
  );
}
