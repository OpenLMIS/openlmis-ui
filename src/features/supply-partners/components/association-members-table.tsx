import { type CellContext, createColumnHelper, useTable } from '@tanstack/react-table';
import { Trash2Icon } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { ReferenceName } from '@/features/supply-partners/components/supply-partner-references';

type Member = { id: string; name: string | null; code: string; note?: string; loading?: boolean };
const helper = createColumnHelper<DataTableFeatures, Member>();
type MemberActions = {
  kind: 'facilities' | 'products';
  pending: boolean;
  onRemove: (id: string) => void;
};
const MemberActionsContext = createContext<MemberActions | null>(null);
function MemberRemoveCell({ row }: CellContext<DataTableFeatures, Member, unknown>) {
  const actions = useContext(MemberActionsContext);
  const { t } = useTranslation();
  if (!actions) return null;
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        disabled={actions.pending || row.original.loading}
        variant="destructive-ghost"
        size="icon-sm"
        aria-label={t('supply-partners.remove-item', {
          item:
            row.original.name ||
            row.original.code ||
            t(
              actions.kind === 'facilities'
                ? 'supply-partners.facilities'
                : 'supply-partners.products',
            ),
        })}
        onClick={() => actions.onRemove(row.original.id)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
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
              <ReferenceName name={row.original.name} pending={Boolean(row.original.loading)} />
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
          cell: MemberRemoveCell,
        }),
      ]),
    [t],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    enableSorting: false,
  });
  return (
    <MemberActionsContext value={{ kind, pending, onRemove }}>
      <DataTable
        table={table}
        layout="auto"
        empty={
          <DataTableEmpty
            title={t(
              kind === 'facilities'
                ? 'supply-partners.no-facilities'
                : 'supply-partners.no-products',
            )}
          />
        }
      />
    </MemberActionsContext>
  );
}
