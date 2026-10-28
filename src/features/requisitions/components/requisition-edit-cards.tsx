import { Trash2Icon } from 'lucide-react';
import { Fragment, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import { CardBand, CardControlRow, CardList, CardListItem, CardRows } from '@/components/card-list';
import { productLabel } from '@/features/reference-data/lib/products';
import type { GridRow } from '@/features/requisitions/components/requisition-grid';
import type { GridColumn } from '@/features/requisitions/lib/template';
import { EMPTY_VALUE } from '@/lib/empty-value';

export function RequisitionEditCards({
  rows,
  columns,
  renderCell,
  footer,
  empty,
  listRef,
  remove,
  invalid,
}: {
  rows: GridRow[];
  columns: GridColumn[];
  renderCell: (column: GridColumn, row: GridRow) => ReactNode;
  footer: ReactNode;
  empty: ReactNode;
  listRef: Ref<HTMLUListElement>;
  remove?: (id: string) => void;
  invalid: (id: string) => boolean;
}) {
  const { t } = useTranslation();
  return (
    <CardList empty={!rows.length && empty} footer={footer} listRef={listRef}>
      {rows.map((row) =>
        row.category !== undefined ? (
          <li key={row.id}>
            <h3 className="font-semibold text-sm">{row.category}</h3>
          </li>
        ) : (
          row.model && (
            <CardListItem key={row.id} tone={row.model.line.skipped ? 'skipped' : undefined}>
              <div className={invalid(row.id) ? 'bg-destructive/10' : undefined}>
                <CardBand>
                  <bdi>
                    {row.model.product
                      ? `${productLabel(row.model.product)} (${row.model.product.productCode})`
                      : EMPTY_VALUE}
                  </bdi>
                  {remove && (
                    <CardActions
                      label={t('requisitions.edit.line-actions')}
                      actions={[
                        {
                          id: 'remove',
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
                    .map((column) => (
                      <Fragment key={column.name}>
                        <CardControlRow
                          label={column.label}
                          width={column.convertsToPacks ? 'wide' : 'half'}
                        >
                          {renderCell(column, row) ?? EMPTY_VALUE}
                        </CardControlRow>
                      </Fragment>
                    ))}
                </CardRows>
              </div>
            </CardListItem>
          )
        ),
      )}
    </CardList>
  );
}
