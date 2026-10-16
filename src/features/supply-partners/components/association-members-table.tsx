import { createColumnHelper, useTable } from '@tanstack/react-table';
import { Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';

type Member = { id: string; name: string | null; code: string; note?: string };
const helper = createColumnHelper<DataTableFeatures, Member>();
export function AssociationMembersTable({
  rows,
  kind,
  pending,
  onRemove,
}: {
  rows: Member[];
  kind: 'facilities' | 'products';
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: t('supply-partners.name'),
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span dir="auto">{row.original.name}</span>
              {row.original.note && (
                <span className="text-muted-foreground text-xs">{row.original.note}</span>
              )}
            </div>
          ),
        }),
        helper.accessor('code', {
          header: t('supply-partners.code'),
          cell: ({ getValue }) => <span dir="auto">{getValue()}</span>,
        }),
        helper.display({
          id: 'remove',
          header: () => <span className="sr-only">{t('supply-partners.actions')}</span>,
          meta: { className: 'w-16' },
          cell: ({ row }) => (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={pending}
                variant="destructive-ghost"
                size="icon-sm"
                aria-label={t('supply-partners.remove-item', {
                  item: row.original.name || row.original.code,
                })}
                onClick={() => onRemove(row.original.id)}
              >
                <Trash2Icon />
              </Button>
            </div>
          ),
        }),
      ]),
    [t, onRemove, pending],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    enableSorting: false,
  });
  return (
    <DataTable
      table={table}
      layout="auto"
      empty={
        <DataTableEmpty
          title={t(
            kind === 'facilities' ? 'supply-partners.no-facilities' : 'supply-partners.no-products',
          )}
        />
      }
    />
  );
}
