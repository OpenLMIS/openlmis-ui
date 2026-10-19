import { type CellContext, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Trash2Icon } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { TableCards } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { ReferenceName } from '@/features/supply-partners/components/supply-partner-references';
import { useDialogCardLayout } from '@/hooks/use-card-view';

export type Member = {
  id: string;
  name: string | null;
  code: string;
  note?: string;
  loading?: boolean;
  removeDisabled?: boolean;
};
const helper = createColumnHelper<DataTableFeatures, Member>();
type MemberActions = {
  kind: 'facilities' | 'products';
  pending: boolean;
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
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
        disabled={actions.pending || row.original.loading || row.original.removeDisabled}
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
        onClick={(event) => actions.onRemove(row.original.id, event.currentTarget)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
export function memberColumns(t: TFunction) {
  return [
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
      cell: ({ getValue }) => getValue() && <span dir="auto">{getValue()}</span>,
      meta: { label: t('supply-partners.code') },
    }),
  ];
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
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const { measure, cards } = useDialogCardLayout<HTMLDivElement>('table');
  const columns = useMemo(
    () =>
      helper.columns([
        ...memberColumns(t),
        helper.display({
          id: 'actions',
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
  const empty = (
    <DataTableEmpty
      title={t(
        kind === 'facilities' ? 'supply-partners.no-facilities' : 'supply-partners.no-products',
      )}
    />
  );
  return (
    <MemberActionsContext value={{ kind, pending, onRemove }}>
      <div ref={measure}>
        {cards ? (
          <TableCards empty={empty} surface="flat" table={table} title="name" />
        ) : (
          <DataTable table={table} layout="auto" empty={empty} />
        )}
      </div>
    </MemberActionsContext>
  );
}
