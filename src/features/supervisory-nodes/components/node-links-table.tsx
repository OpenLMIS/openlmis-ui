import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearch } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { NetworkIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
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
  type ResponsiveColumn,
  resolveColumnVisibility,
  useElementWidth,
} from '@/components/data-table/responsive-columns';
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
  minimalFacilitiesOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import {
  AddNodePicker,
  AddNodePickerSkeleton,
} from '@/features/supervisory-nodes/components/add-node-picker';
import type { NodeEditSearch, NodeLinkKind } from '@/features/supervisory-nodes/lib/edit-search';
import { facilityNames } from '@/features/supervisory-nodes/lib/facility-names';
import type { DraftNode } from '@/features/supervisory-nodes/lib/node-form';
import { visibleSavedIds } from '@/features/supervisory-nodes/lib/visible-saved-ids';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, type TableSearch, useTableSearchState } from '@/lib/table-search';

const CLOSED_DIALOGS = {};
const NO_SORT = { id: 'name', desc: false };
const NO_ROWS: LinkRow[] = [];
const LINK_COLUMNS: ResponsiveColumn[] = [{ id: 'facilityName', hideBelow: 'lg' }];
const NO_CHOICES = {};
const noop = () => {};
type LinkRow = DraftNode & { facilityName: string | null };
type NodeLinksTableProps = {
  kind: NodeLinkKind;
  selfId: string;
  savedIds: ReadonlySet<string>;
  rows: DraftNode[];
  parentId: string | null;
  disabled: boolean;
  onAdd: (node: DraftNode) => void;
  onRemove: (index: number) => void;
};

export function NodeLinksTable({
  kind,
  selfId,
  savedIds,
  rows,
  parentId,
  disabled,
  onAdd,
  onRemove,
}: NodeLinksTableProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const search: NodeEditSearch = useSearch({ strict: false });
  const { updateSearch } = useSearchNavigation<NodeEditSearch>(CLOSED_DIALOGS);
  const pageKey = kind === 'child' ? 'childPage' : 'partnerPage';
  const sizeKey = kind === 'child' ? 'childSize' : 'partnerSize';
  const size = search[sizeKey] ?? 10;
  const requestedPage = search[pageKey] ?? 1;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / size)));
  const tableRegion = useRef<HTMLDivElement>(null);
  const [measureTable, tableWidth] = useElementWidth<HTMLDivElement>();
  const columnVisibility = useMemo(
    () => resolveColumnVisibility(LINK_COLUMNS, NO_CHOICES, tableWidth),
    [tableWidth],
  );
  const pickerRegion = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [removing, setRemoving] = useState<string>();
  const [focus, setFocus] = useState<{ id: string | null; ready: boolean } | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [renderedRows, setRenderedRows] = useState<readonly LinkRow[]>([]);
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
    if (!focus?.ready || requestedPage !== page) return;
    const index = rows.findIndex(({ id }) => id === focus.id);
    if (
      index >= 0 &&
      (Math.floor(index / size) + 1 !== page || !renderedRows.some(({ id }) => id === focus.id))
    )
      return;
    const frame = requestAnimationFrame(() => {
      const buttons = tableRegion.current?.querySelectorAll<HTMLElement>('[data-node-remove]');
      const target = [...(buttons ?? [])].find((button) => button.dataset.nodeRemove === focus.id);
      if (index >= 0 && !target) return;
      (target ?? pickerRegion.current?.querySelector('input'))?.focus();
      setFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, requestedPage, page, rows, size, renderedRows]);
  useEffect(() => {
    if (!focus?.id || !rows.some(({ id }) => id === focus.id) || page !== requestedPage) return;
    const targetPage = Math.floor(rows.findIndex(({ id }) => id === focus.id) / size) + 1;
    if (targetPage !== requestedPage) {
      updateSearch({ [pageKey]: targetPage === 1 ? undefined : targetPage }, true, {
        resetScroll: false,
        keepState: true,
      });
    }
  }, [focus, rows, size, requestedPage, page, updateSearch, pageKey]);
  useEffect(() => {
    if (!reveal) return;
    const index = rows.findIndex(({ id }) => id === reveal);
    setReveal(null);
    const targetPage = Math.floor(index / size) + 1;
    if (index >= 0 && targetPage !== requestedPage) {
      updateSearch({ [pageKey]: targetPage === 1 ? undefined : targetPage }, true, {
        resetScroll: false,
        keepState: true,
      });
    }
  }, [reveal, rows, size, requestedPage, updateSearch, pageKey]);
  const finishFocus = () => setFocus((previous) => previous && { ...previous, ready: true });
  const dialog = removeDialog.dialogProps(disabled);
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <NodeLinksHeader kind={kind} headingId={headingId} pickerRef={pickerRegion}>
        <AddNodePicker
          kind={kind}
          selfId={selfId}
          rows={rows}
          parentId={parentId}
          disabled={disabled}
          onAdd={(node) => {
            setReveal(node.id);
            onAdd(node);
          }}
        />
      </NodeLinksHeader>
      <div
        ref={(element) => {
          tableRegion.current = element;
          measureTable(element);
        }}
      >
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <LoadError
              error={error}
              reset={reset}
              title={t('supervisory-nodes.form.lookup-error')}
              description={t('error.check-connection')}
            />
          )}
          pendingFallback={
            <NodeLinksTableSkeleton
              kind={kind}
              columnVisibility={columnVisibility}
              page={page}
              size={size}
              rowCount={Math.min(size, Math.max(0, rows.length - (page - 1) * size))}
            />
          }
          resetKey={`${selfId}:${kind}`}
        >
          <NodeLinksRows
            kind={kind}
            columnVisibility={columnVisibility}
            rows={rows}
            savedIds={savedIds}
            page={page}
            size={size}
            disabled={disabled}
            onRemove={setRemoving}
            onSearchChange={onSearchChange}
            onRendered={setRenderedRows}
          />
        </QueryBoundary>
      </div>
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
  const label = node.name || node.code || node.id;
  return (
    <div className="flex justify-center gap-1">
      <Button
        aria-label={t('supervisory-nodes.edit-node', { node: label })}
        disabled={disabled}
        nativeButton={false}
        render={
          <Link
            to="/administration/supervisory-nodes/$id"
            params={{ id: node.id }}
            state={{ supervisoryNodesListSearch: listSearch }}
          />
        }
        size="icon-sm"
        variant="ghost"
      >
        <PencilIcon />
      </Button>
      <Button
        aria-label={t(`supervisory-nodes.form.remove-${kind}-node`, { node: label })}
        data-node-remove={node.id}
        disabled={disabled}
        onClick={() => onRemove(node.id)}
        size="icon-sm"
        type="button"
        variant="destructive"
      >
        <Trash2Icon />
      </Button>
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
        <span className="whitespace-nowrap font-medium" dir="auto">
          {tableValue(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('code', {
      header: t('supervisory-nodes.code'),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap" dir="ltr">
          {tableValue(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('facilityName', {
      header: t('supervisory-nodes.facility'),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap" dir="auto">
          {tableValue(getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('supervisory-nodes.actions')}</span>,
      meta: { className: 'w-24' },
      cell: ({ row }) => (
        <NodeLinkActions node={row.original} kind={kind} disabled={disabled} onRemove={onRemove} />
      ),
    }),
  ]);
}

type LinksTableOptions = {
  kind: NodeLinkKind;
  columnVisibility: ColumnVisibilityState;
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
  columnVisibility,
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
    state: { ...searchState.state, columnVisibility },
  });
}

function NodeLinksTableSkeleton({
  kind,
  columnVisibility,
  page = 1,
  size = 10,
  rowCount,
}: {
  kind: NodeLinkKind;
  columnVisibility: ColumnVisibilityState;
  page?: number;
  size?: number;
  rowCount: number;
}) {
  const table = useLinksTable({
    kind,
    columnVisibility,
    page,
    size,
    rows: NO_ROWS,
    rowCount: 0,
    disabled: true,
    onRemove: noop,
    onSearchChange: noop,
  });
  return rowCount > 0 ? (
    <DataTableSkeleton table={table} rowCount={rowCount} layout="auto" />
  ) : (
    <DataTable table={table} layout="auto" empty={<NodeLinksEmpty kind={kind} />} />
  );
}

function NodeLinksRows({
  rows,
  savedIds,
  onRendered,
  ...props
}: Omit<LinksTableOptions, 'rows' | 'rowCount'> & {
  rows: DraftNode[];
  savedIds: ReadonlySet<string>;
  onRendered: (rows: readonly LinkRow[]) => void;
}) {
  const requestedPage = useDeferredValue(props.page);
  const deferredSize = useDeferredValue(props.size);
  const deferredPage = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / deferredSize)));
  const ids = visibleSavedIds(rows, deferredPage, deferredSize, savedIds);
  const { data: nodes } = useSuspenseQuery(supervisoryNodesByIdsOptions(ids));
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const resolved = useMemo(() => {
    const savedNodes = new Map(nodes.map((node) => [node.id, node]));
    const names = facilityNames(facilities);
    return rows
      .slice((deferredPage - 1) * deferredSize, deferredPage * deferredSize)
      .map((draft) => {
        const saved = savedNodes.get(draft.id);
        const facilityId = draft.name !== undefined ? draft.facilityId : saved?.facility?.id;
        return {
          id: draft.id,
          name: draft.name ?? saved?.name,
          code: draft.code ?? saved?.code,
          facilityName: facilityId ? (names.get(facilityId) ?? null) : null,
        };
      });
  }, [rows, nodes, facilities, deferredPage, deferredSize]);
  useEffect(() => onRendered(resolved), [resolved, onRendered]);
  const table = useLinksTable({
    ...props,
    page: deferredPage,
    size: deferredSize,
    rows: resolved,
    rowCount: rows.length,
  });
  return (
    <DataTable
      table={table}
      isStale={props.page !== deferredPage || props.size !== deferredSize}
      layout="auto"
      empty={<NodeLinksEmpty kind={props.kind} />}
      footer={rows.length > 0 && <DataTablePagination table={table} disabled={props.disabled} />}
    />
  );
}

function NodeLinksEmpty({ kind }: { kind: NodeLinkKind }) {
  const { t } = useTranslation();
  return (
    <DataTableEmpty
      icon={<NetworkIcon />}
      title={t(
        kind === 'child'
          ? 'supervisory-nodes.form.no-children-title'
          : 'supervisory-nodes.form.no-partners-title',
      )}
      description={t(
        kind === 'child'
          ? 'supervisory-nodes.form.no-children-description'
          : 'supervisory-nodes.form.no-partners-description',
      )}
    />
  );
}

function NodeLinksHeader({
  kind,
  headingId,
  pickerRef,
  children,
}: {
  kind: NodeLinkKind;
  headingId?: string;
  pickerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center">
      <h2 className="font-semibold text-lg @3xl/main:me-auto" id={headingId}>
        {t(
          kind === 'child' ? 'supervisory-nodes.form.children' : 'supervisory-nodes.form.partners',
        )}
      </h2>
      <div className="flex w-full items-center gap-2 @3xl/main:max-w-sm" ref={pickerRef}>
        {children}
      </div>
    </div>
  );
}

export function NodeLinksSectionSkeleton({ kind }: { kind: NodeLinkKind }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <NodeLinksHeader kind={kind}>
        <AddNodePickerSkeleton kind={kind} />
      </NodeLinksHeader>
      <MeasuredLinksSkeleton kind={kind} />
    </section>
  );
}

function MeasuredLinksSkeleton({ kind }: { kind: NodeLinkKind }) {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const columnVisibility = useMemo(
    () => resolveColumnVisibility(LINK_COLUMNS, NO_CHOICES, width),
    [width],
  );
  return (
    <div ref={measure}>
      <NodeLinksTableSkeleton kind={kind} columnVisibility={columnVisibility} rowCount={2} />
    </div>
  );
}
