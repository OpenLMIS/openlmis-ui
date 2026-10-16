import { type CellContext, createColumnHelper, useTable } from '@tanstack/react-table';
import { EllipsisIcon, PencilIcon, Trash2Icon, TruckIcon } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ReferenceName,
  usePartnerReferences,
} from '@/features/supply-partners/components/supply-partner-references';
import { associationKey } from '@/features/supply-partners/lib/association';
import type { SupplyPartnerEditSearch } from '@/features/supply-partners/lib/search';
import type { AssociationDraft } from '@/features/supply-partners/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, AssociationDraft>();
const NO_SORT = { id: 'program', desc: false };
const EMPTY: AssociationDraft[] = [];
const noop = () => {};
type Actions = {
  programs: readonly { id: string; name: string | null }[];
  nodes: readonly { id: string; name: string | null }[];
  pending: boolean;
  onEdit?: (key: string, trigger: HTMLButtonElement | null) => void;
  onRemove: (key: string, index: number, trigger: HTMLButtonElement | null) => void;
};
const ActionsContext = createContext<Actions | null>(null);
function AssociationActionsCell({
  row,
}: CellContext<DataTableFeatures, AssociationDraft, unknown>) {
  const actions = useContext(ActionsContext);
  const { t } = useTranslation();
  if (!actions) return null;
  return (
    <AssociationActions
      program={
        actions.programs.find(({ id }) => id === row.original.programId)?.name ??
        t('supply-partners.unavailable')
      }
      node={
        actions.nodes.find(({ id }) => id === row.original.supervisoryNodeId)?.name ??
        t('supply-partners.unavailable')
      }
      pending={actions.pending}
      onEdit={
        actions.onEdit
          ? (trigger) => actions.onEdit?.(associationKey(row.original), trigger)
          : undefined
      }
      onRemove={(trigger) => actions.onRemove(associationKey(row.original), row.index, trigger)}
    />
  );
}
function AssociationActions({
  program,
  node,
  pending,
  onEdit,
  onRemove,
}: {
  program: string;
  node: string;
  pending: boolean;
  onEdit?: (trigger: HTMLButtonElement | null) => void;
  onRemove: (trigger: HTMLButtonElement | null) => void;
}) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              ref={trigger}
              data-association-actions
              type="button"
              disabled={pending}
              variant="ghost"
              size="icon-sm"
              aria-label={t('supply-partners.association-actions-for', { program, node })}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto" finalFocus={menu.finalFocus}>
          <DropdownMenuGroup>
            {onEdit && (
              <DropdownMenuItem onClick={menu.opensDialog(() => onEdit(trigger.current))}>
                <PencilIcon />
                {t('supply-partners.edit-association')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={menu.opensDialog(() => onRemove(trigger.current))}
            >
              <Trash2Icon />
              {t('supply-partners.remove')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
function useAssociationTable({
  rows,
  search,
  onSearchChange,
  onView,
  pending,
}: {
  rows: AssociationDraft[];
  search: SupplyPartnerEditSearch;
  onSearchChange: SearchChange<SupplyPartnerEditSearch>;
  onView: (kind: 'facilities' | 'products', key: string) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const refs = usePartnerReferences(rows);
  const size = search.size ?? 10;
  const page = Math.min(search.page ?? 1, Math.max(1, Math.ceil(rows.length / size)));
  useEffect(() => {
    if (page !== (search.page ?? 1))
      onSearchChange({ page: page > 1 ? page : undefined }, true, { keepState: true });
  }, [page, search.page, onSearchChange]);
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: 'program',
          header: t('supply-partners.program'),
          cell: ({ row }) => (
            <ReferenceName
              pending={refs.programs.isPending}
              name={refs.programs.data?.find(({ id }) => id === row.original.programId)?.name}
            />
          ),
        }),
        helper.display({
          id: 'node',
          header: t('supply-partners.node'),
          cell: ({ row }) => (
            <ReferenceName
              pending={refs.nodes.isPending}
              name={refs.nodes.data?.find(({ id }) => id === row.original.supervisoryNodeId)?.name}
            />
          ),
        }),
        ...(['facilities', 'products'] as const).map((kind) =>
          helper.display({
            id: kind,
            header: t(
              kind === 'facilities' ? 'supply-partners.facilities' : 'supply-partners.products',
            ),
            cell: ({ row }) => {
              const item = row.original;
              const program =
                refs.programs.data?.find(({ id }) => id === item.programId)?.name ??
                t('supply-partners.unavailable');
              const node =
                refs.nodes.data?.find(({ id }) => id === item.supervisoryNodeId)?.name ??
                t('supply-partners.unavailable');
              return (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>
                    {t(
                      kind === 'facilities'
                        ? 'supply-partners.facility-count'
                        : 'supply-partners.product-count',
                      {
                        count: (kind === 'facilities' ? item.facilityIds : item.orderableIds)
                          .length,
                      },
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={pending}
                    aria-label={t('supply-partners.view-for', {
                      kind: t(
                        kind === 'facilities'
                          ? 'supply-partners.facilities'
                          : 'supply-partners.products',
                      ),
                      program,
                      node,
                    })}
                    onClick={() => onView(kind, associationKey(item))}
                  >
                    {t('supply-partners.view')}
                  </Button>
                </div>
              );
            },
          }),
        ),
        helper.display({
          id: 'actions',
          header: () => <span className="sr-only">{t('supply-partners.actions')}</span>,
          meta: { className: 'w-16' },
          cell: AssociationActionsCell,
        }),
      ]),
    [
      t,
      refs.programs.data,
      refs.programs.isPending,
      refs.nodes.data,
      refs.nodes.isPending,
      onView,
      pending,
    ],
  );
  const state = useTableSearchState({
    search: { ...search, page },
    defaultSort: NO_SORT,
    onSearchChange,
  });
  return {
    table: useTable({
      features: dataTableFeatures,
      columns,
      data: rows.slice((page - 1) * size, page * size),
      rowCount: rows.length,
      getRowId: associationKey,
      manualPagination: true,
      enableSorting: false,
      ...state,
    }),
    refs,
  };
}
export function AssociationsTable({
  rows,
  search,
  onSearchChange,
  onView,
  onEdit,
  onChange,
  pending,
}: {
  rows: AssociationDraft[];
  search: SupplyPartnerEditSearch;
  onSearchChange: SearchChange<SupplyPartnerEditSearch>;
  onView: (kind: 'facilities' | 'products', key: string) => void;
  onEdit?: (key: string, trigger: HTMLButtonElement | null) => void;
  onChange: (rows: AssociationDraft[]) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [removing, setRemoving] = useState<{ key: string; index: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const focusRemoved = useRef<number | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const onRemove = useCallback((key: string, index: number, trigger: HTMLButtonElement | null) => {
    returnFocus.current = trigger;
    setRemoving({ key, index });
  }, []);
  const { table, refs } = useAssociationTable({
    rows,
    search,
    onSearchChange,
    onView,
    pending,
  });
  const target = rows.find((row) => associationKey(row) === removing?.key);
  const program =
    refs.programs.data?.find(({ id }) => id === target?.programId)?.name ??
    t('supply-partners.unavailable');
  const node =
    refs.nodes.data?.find(({ id }) => id === target?.supervisoryNodeId)?.name ??
    t('supply-partners.unavailable');
  return (
    <div className="flex flex-col gap-4" ref={ref} tabIndex={-1}>
      <ActionsContext
        value={{
          programs: refs.programs.data ?? [],
          nodes: refs.nodes.data ?? [],
          pending,
          onEdit,
          onRemove,
        }}
      >
        <DataTable
          layout="auto"
          table={table}
          empty={
            <DataTableEmpty icon={<TruckIcon />} title={t('supply-partners.empty-associations')} />
          }
          footer={rows.length > 0 && <DataTablePagination table={table} />}
        />
      </ActionsContext>
      <AlertDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !pending) setRemoving(null);
        }}
        onOpenChangeComplete={(open) => {
          if (open || focusRemoved.current === null) return;
          const index = focusRemoved.current;
          focusRemoved.current = null;
          requestAnimationFrame(() => {
            const buttons = ref.current?.querySelectorAll<HTMLElement>(
              '[data-association-actions]',
            );
            (buttons?.[Math.min(index, buttons.length - 1)] ?? ref.current)?.focus();
          });
        }}
      >
        <AlertDialogContent finalFocus={focusRemoved.current === null ? returnFocus : false}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('supply-partners.remove-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('supply-partners.remove-description', { program, node })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!removing) return;
                focusRemoved.current = removing.index;
                onChange(rows.filter((item) => associationKey(item) !== removing.key));
                setRemoving(null);
              }}
            >
              {t('supply-partners.remove')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
export function AssociationsTableSkeleton({ search }: { search: SupplyPartnerEditSearch }) {
  const { table } = useAssociationTable({
    rows: EMPTY,
    search,
    onSearchChange: noop,
    onView: noop,
    pending: true,
  });
  return <DataTableSkeleton layout="auto" table={table} rowCount={search.size ?? 10} />;
}
