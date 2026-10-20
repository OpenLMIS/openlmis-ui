import { type CellContext, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Trash2Icon } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { TableCards, useInCards } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { ReferenceName } from '@/features/supply-partners/components/supply-partner-references';

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
  const cards = useInCards();
  if (!actions) return null;
  const name = t('supply-partners.remove-item', {
    item:
      row.original.name ||
      row.original.code ||
      t(actions.kind === 'facilities' ? 'supply-partners.facilities' : 'supply-partners.products'),
  });
  const disabled = actions.pending || row.original.loading || row.original.removeDisabled;
  if (cards) {
    return (
      <CardActions
        label={t('card-actions.actions-for', {
          name: row.original.name || row.original.code || row.original.id,
        })}
        actions={[
          {
            id: 'remove',
            icon: <Trash2Icon />,
            label: t('supply-partners.remove'),
            name,
            destructive: true,
            disabled,
            onSelect: (trigger) => actions.onRemove(row.original.id, trigger),
          },
        ]}
      />
    );
  }
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        disabled={disabled}
        variant="destructive-ghost"
        size="icon-sm"
        aria-label={name}
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
      cell: ({ row }) =>
        (row.original.loading || row.original.name || row.original.note) && (
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
  cards,
  rows,
  kind,
  pending,
  onRemove,
}: {
  cards: boolean;
  rows: Member[];
  kind: 'facilities' | 'products';
  pending: boolean;
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () =>
      helper.columns([
        ...memberColumns(t),
        helper.display({
          id: 'actions',
          header: () => <span className="sr-only">{t('supply-partners.actions')}</span>,
          meta: { className: 'w-16' },
          cell: (context) => <MemberRemoveCell {...context} />,
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
      {cards ? (
        <TableCards empty={empty} surface="flat" table={table} title="name" />
      ) : (
        <DataTable table={table} layout="auto" empty={empty} />
      )}
    </MemberActionsContext>
  );
}
