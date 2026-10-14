import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearch } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, NetworkIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
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
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { supervisoryNodesByIdsOptions } from '@/features/supervisory-nodes/api/queries';
import {
  AddNodeDialog,
  type NodeLinkKind,
} from '@/features/supervisory-nodes/components/add-node-dialog';
import type { NodeEditSearch } from '@/features/supervisory-nodes/lib/edit-search';
import type { DraftNode, NodeDraft } from '@/features/supervisory-nodes/lib/node-form';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, type TableSearch, useTableSearchState } from '@/lib/table-search';

const CLOSED_DIALOGS = { add: undefined };
const NO_SORT = { id: 'name', desc: false };
const NO_ROWS: LinkRow[] = [];
const noop = () => {};
type LinkRow = DraftNode & { facilityName: string | null };
type NodeLinksTableProps = {
  kind: NodeLinkKind;
  selfId: string;
  savedIds: readonly string[];
  draft: NodeDraft;
  disabled: boolean;
  onAdd: (node: DraftNode) => void;
  onRemove: (index: number) => void;
};

export function NodeLinksTable({
  kind,
  selfId,
  savedIds,
  draft,
  disabled,
  onAdd,
  onRemove,
}: NodeLinksTableProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const rows = kind === 'child' ? draft.children : draft.partners;
  const search: NodeEditSearch = useSearch({ strict: false });
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<NodeEditSearch>(CLOSED_DIALOGS);
  const pageKey = kind === 'child' ? 'childPage' : 'partnerPage';
  const sizeKey = kind === 'child' ? 'childSize' : 'partnerSize';
  const size = search[sizeKey] ?? 10;
  const requestedPage = search[pageKey] ?? 1;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / size)));
  const tableRegion = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [removing, setRemoving] = useState<string>();
  const [focus, setFocus] = useState<{ id: string | null; ready: boolean } | null>(null);
  const removeDialog = useDialogTarget(removing, () => setRemoving(undefined));
  const onSearchChange = useCallback<SearchChange<TableSearch>>(
    (update, replace) => {
      updateSearch(
        (previous) => {
          const next =
            typeof update === 'function'
              ? update({ page: previous[pageKey], size: previous[sizeKey] })
              : update;
          return { [pageKey]: next.page, [sizeKey]: next.size };
        },
        replace,
        { resetScroll: false, keepState: true },
      );
    },
    [updateSearch, pageKey, sizeKey],
  );
  useEffect(() => {
    if (page !== requestedPage)
      updateSearch({ [pageKey]: page === 1 ? undefined : page }, true, {
        resetScroll: false,
        keepState: true,
      });
  }, [page, requestedPage, pageKey, updateSearch]);
  useEffect(() => {
    if (!focus?.ready || requestedPage !== page || search.add) return;
    const index = rows.findIndex(({ id }) => id === focus.id);
    if (index >= 0 && Math.floor(index / size) + 1 !== page) return;
    const frame = requestAnimationFrame(() => {
      const buttons = tableRegion.current?.querySelectorAll<HTMLElement>('[data-node-menu]');
      const target = [...(buttons ?? [])].find((button) => button.dataset.nodeMenu === focus.id);
      (target ?? addButton.current)?.focus();
      setFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, requestedPage, page, search.add, rows, size]);
  useEffect(() => {
    if (
      !focus?.id ||
      !rows.some(({ id }) => id === focus.id) ||
      search.add ||
      page !== requestedPage
    )
      return;
    const targetPage = Math.floor(rows.findIndex(({ id }) => id === focus.id) / size) + 1;
    if (targetPage !== requestedPage) {
      updateSearch({ [pageKey]: targetPage === 1 ? undefined : targetPage }, true, {
        resetScroll: false,
        keepState: true,
      });
    }
  }, [focus, rows, size, requestedPage, page, search.add, updateSearch, pageKey]);
  const finishFocus = () => setFocus((previous) => previous && { ...previous, ready: true });
  const dialog = removeDialog.dialogProps(disabled);
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <h2 className="font-semibold text-lg" id={headingId}>
        {t(
          kind === 'child' ? 'supervisory-nodes.form.children' : 'supervisory-nodes.form.partners',
        )}
      </h2>
      <div className="flex justify-end">
        <Button
          disabled={disabled}
          onClick={() => void openDialog({ add: kind })}
          ref={addButton}
          type="button"
          variant="outline"
        >
          <PlusIcon data-icon="inline-start" />
          {t(`supervisory-nodes.form.add-${kind}`)}
        </Button>
      </div>
      <div ref={tableRegion}>
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <LoadError
              error={error}
              reset={reset}
              title={t('supervisory-nodes.form.lookup-error')}
              description={t('error.check-connection')}
            />
          )}
          pendingFallback={<NodeLinksTableSkeleton kind={kind} page={page} size={size} />}
          resetKey={`${selfId}:${kind}`}
        >
          <NodeLinksRows
            kind={kind}
            rows={rows}
            savedIds={savedIds}
            page={page}
            size={size}
            disabled={disabled}
            onRemove={setRemoving}
            onSearchChange={onSearchChange}
          />
        </QueryBoundary>
      </div>
      <AddNodeDialog
        kind={kind}
        open={search.add === kind}
        selfId={selfId}
        draft={draft}
        disabled={disabled}
        onAdd={(node) => {
          setFocus({ id: node.id, ready: false });
          onAdd(node);
        }}
        onClose={closeDialog}
        onClosed={finishFocus}
      />
      <AlertDialog
        {...dialog}
        onOpenChangeComplete={(next) => {
          dialog.onOpenChangeComplete(next);
          if (!next) finishFocus();
        }}
      >
        <AlertDialogContent finalFocus={focus ? false : undefined} initialFocus={cancelButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`supervisory-nodes.form.remove-${kind}`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`supervisory-nodes.form.remove-${kind}-confirm`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabled} ref={cancelButton}>
              {t('dialog.cancel')}
            </AlertDialogCancel>
            <Button
              disabled={disabled}
              type="button"
              variant="destructive"
              onClick={() => {
                const index = rows.findIndex(({ id }) => id === removeDialog.shown);
                if (index < 0 || disabled || !removeDialog.close()) return;
                setFocus({ id: rows[index + 1]?.id ?? rows[index - 1]?.id ?? null, ready: false });
                onRemove(index);
              }}
            >
              {t(`supervisory-nodes.form.remove-${kind}`)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function NodeLinkActions({
  node,
  kind,
  disabled,
  onRemove,
}: {
  node: LinkRow;
  kind: NodeLinkKind;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const listSearch = useLocation({
    select: (location) => location.state.supervisoryNodesListSearch,
  });
  const menu = useMenuOpensDialog();
  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('supervisory-nodes.form.actions-for', {
                node: node.name || node.code || node.id,
              })}
              data-node-menu={node.id}
              disabled={disabled}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to="/administration/supervisory-nodes/$id"
                  params={{ id: node.id }}
                  state={{ supervisoryNodesListSearch: listSearch }}
                />
              }
            >
              <PencilIcon />
              {t('supervisory-nodes.form.edit-node')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={menu.opensDialog(() => onRemove(node.id))}
              variant="destructive"
            >
              <Trash2Icon />
              {t(`supervisory-nodes.form.remove-${kind}`)}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const columnHelper = createColumnHelper<DataTableFeatures, LinkRow>();
function createColumns(
  t: TFunction,
  kind: NodeLinkKind,
  disabled: boolean,
  onRemove: (id: string) => void,
) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: t('supervisory-nodes.name'),
      cell: ({ getValue }) => (
        <span className="font-medium" dir="auto">
          {tableValue(getValue())}
        </span>
      ),
      meta: { className: 'w-48' },
    }),
    columnHelper.accessor('code', {
      header: t('supervisory-nodes.code'),
      cell: ({ getValue }) => <span dir="ltr">{tableValue(getValue())}</span>,
      meta: { className: 'w-28' },
    }),
    columnHelper.accessor('facilityName', {
      header: t('supervisory-nodes.facility'),
      cell: ({ getValue }) => <span dir="auto">{tableValue(getValue())}</span>,
      meta: { className: 'w-48' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('supervisory-nodes.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => (
        <NodeLinkActions node={row.original} kind={kind} disabled={disabled} onRemove={onRemove} />
      ),
    }),
  ]);
}

type LinksTableOptions = {
  kind: NodeLinkKind;
  page: number;
  size: number;
  rows: LinkRow[];
  rowCount: number;
  disabled: boolean;
  onRemove: (id: string) => void;
  onSearchChange: SearchChange<TableSearch>;
};
function useLinksTable({
  kind,
  page,
  size,
  rows,
  rowCount,
  disabled,
  onRemove,
  onSearchChange,
}: LinksTableOptions) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, kind, disabled, onRemove),
    [t, kind, disabled, onRemove],
  );
  const searchState = useTableSearchState({
    search: { page, size },
    defaultSort: NO_SORT,
    onSearchChange,
  });
  return useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    enableHiding: false,
    ...searchState,
  });
}

export function NodeLinksTableSkeleton({
  kind,
  page = 1,
  size = 10,
}: {
  kind: NodeLinkKind;
  page?: number;
  size?: number;
}) {
  const table = useLinksTable({
    kind,
    page,
    size,
    rows: NO_ROWS,
    rowCount: 0,
    disabled: true,
    onRemove: noop,
    onSearchChange: noop,
  });
  return <DataTableSkeleton table={table} rowCount={size} layout="auto" />;
}

function NodeLinksRows({
  rows,
  savedIds,
  ...props
}: Omit<LinksTableOptions, 'rows' | 'rowCount'> & {
  rows: DraftNode[];
  savedIds: readonly string[];
}) {
  const { t } = useTranslation();
  const { data: nodes } = useSuspenseQuery(supervisoryNodesByIdsOptions(savedIds));
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const resolved = useMemo(() => {
    const savedNodes = new Map(nodes.map((node) => [node.id, node]));
    const names = new Map(facilities.map(({ id, name }) => [id, name]));
    return rows.slice((props.page - 1) * props.size, props.page * props.size).map((draft) => {
      const saved = savedNodes.get(draft.id);
      const facilityId = draft.name !== undefined ? draft.facilityId : saved?.facility?.id;
      return {
        id: draft.id,
        name: draft.name ?? saved?.name,
        code: draft.code ?? saved?.code,
        facilityName: facilityId ? (names.get(facilityId) ?? null) : null,
      };
    });
  }, [rows, nodes, facilities, props.page, props.size]);
  const table = useLinksTable({ ...props, rows: resolved, rowCount: rows.length });
  return (
    <DataTable
      table={table}
      layout="auto"
      empty={
        <DataTableEmpty
          icon={<NetworkIcon />}
          title={t(
            props.kind === 'child'
              ? 'supervisory-nodes.form.no-children-title'
              : 'supervisory-nodes.form.no-partners-title',
          )}
          description={t(
            props.kind === 'child'
              ? 'supervisory-nodes.form.no-children-description'
              : 'supervisory-nodes.form.no-partners-description',
          )}
        />
      }
      footer={rows.length > 0 && <DataTablePagination table={table} disabled={props.disabled} />}
    />
  );
}
