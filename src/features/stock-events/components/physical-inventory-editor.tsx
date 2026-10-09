import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  DataTableEmpty,
  type DataTableFeatures,
  DataTableFooter,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { formatDateValue } from '@/components/form/date-value';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  PhysicalInventoryGrid,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import {
  buildInventoryLines,
  filterInventoryLines,
  inventoryPage,
  inventoryProgress,
} from '@/features/stock-events/lib/physical-inventory-lines';
import type { InventorySearch } from '@/features/stock-events/lib/physical-inventory-search';
import type {
  InventoryProductGroup,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { useStoredState } from '@/hooks/use-stored-state';
import { isRefused } from '@/lib/http';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';

const choicesSchema = z.record(z.string(), z.boolean());
const NO_SORT = { id: 'product', desc: false };
const helper = createColumnHelper<DataTableFeatures, InventoryProductGroup>();
const columns = helper.columns([helper.display({ id: 'product' })]);
type Props = {
  draft: PhysicalInventoryDraft;
  search: InventorySearch;
  onSearchChange: SearchChange<InventorySearch>;
};

export function PhysicalInventoryEditor(props: Props) {
  const { t } = useTranslation();
  const inactiveId = useId();
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const choices = useStoredState('physical-inventory.columns', choicesSchema, {});
  const view = useColumnVisibility(INVENTORY_HIDEABLE_COLUMNS, choices, width);
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <DataTableToolbar>
        <div className="w-full @2xl/main:w-72">
          <Input
            aria-label={t('stock-events.keywords')}
            placeholder={t('stock-events.keywords')}
            maxLength={50}
            value={props.search.keyword ?? ''}
            onChange={(event) =>
              props.onSearchChange(
                { keyword: event.target.value || undefined, page: undefined },
                true,
              )
            }
          />
        </div>
        <label htmlFor={inactiveId} className="flex items-center gap-2 text-sm">
          <Switch
            id={inactiveId}
            checked={props.search.includeInactive ?? false}
            onCheckedChange={(checked) =>
              props.onSearchChange({ includeInactive: checked || undefined, page: undefined })
            }
          />
          {t('physical-inventory.include-inactive')}
        </label>
        <div className="ms-auto">
          <DataTableViewOptions
            columns={INVENTORY_HIDEABLE_COLUMNS.map((column) => ({
              id: column.id,
              label: t(column.labelKey),
            }))}
            {...view}
          />
        </div>
      </DataTableToolbar>
      <QueryBoundary
        errorComponent={InventoryLoadError}
        pendingFallback={<PhysicalInventoryGridSkeleton visibility={view.visibility} />}
        resetKey={props.draft.id}
      >
        <InventoryRows {...props} visibility={view.visibility} />
      </QueryBoundary>
    </div>
  );
}

function InventoryRows({
  draft,
  search,
  onSearchChange,
  visibility,
}: Props & { visibility: Record<string, boolean> }) {
  const { t, i18n } = useTranslation();
  const { data: stock } = useSuspenseQuery(inventoryStockLinesOptions(draft));
  const eligible = useQuery(
    eligibleInventoryProductsOptions({ programId: draft.programId, facilityId: draft.facilityId }),
  );
  const deferred = useDeferredValue(search);
  const lines = useMemo(
    () => buildInventoryLines(stock, draft.lineItems, [], eligible.data),
    [stock, draft.lineItems, eligible.data],
  );
  const filtered = useMemo(
    () =>
      filterInventoryLines(
        lines,
        deferred,
        (date) => formatDateValue(date, i18n.language),
        t('stock-events.no-lot-defined'),
      ),
    [lines, deferred, i18n.language, t],
  );
  const page = useMemo(
    () => inventoryPage(filtered, draft.programId, deferred.page, deferred.size),
    [filtered, draft.programId, deferred.page, deferred.size],
  );
  const progress = useMemo(() => inventoryProgress(filtered), [filtered]);
  const tableState = useTableSearchState({
    search: { ...search, page: page.page },
    defaultSort: NO_SORT,
    defaultPageSize: 20,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: page.groups,
    rowCount: page.total,
    manualPagination: true,
    manualSorting: true,
    ...tableState,
  });
  useEffect(() => {
    if (search === deferred && (search.page ?? 1) !== page.page)
      onSearchChange({ page: page.page === 1 ? undefined : page.page }, true);
  }, [search, deferred, page.page, onSearchChange]);
  const showVvm = Boolean(
    eligible.data?.some((line) => line.orderable.extraData?.useVVM === 'true'),
  );
  return (
    <div className="flex flex-col gap-4" aria-busy={search !== deferred}>
      <Progress value={progress.total ? (progress.count / progress.total) * 100 : 0}>
        <ProgressLabel>{t('physical-inventory.progress', progress)}</ProgressLabel>
      </Progress>
      {eligible.isError ? (
        <LoadError
          error={eligible.error}
          reset={() => {
            void eligible.refetch();
          }}
          title={t('physical-inventory.load-error-title')}
          description={t('physical-inventory.load-error-description')}
        />
      ) : null}
      {filtered.length ? (
        <>
          <PhysicalInventoryGrid bands={page.bands} visibility={visibility} showVvm={showVvm} />
          <DataTableFooter>
            <DataTablePagination table={table} />
          </DataTableFooter>
        </>
      ) : (
        <DataTableEmpty
          title={t(
            search.keyword || search.includeInactive
              ? 'stock-events.no-matches-title'
              : 'physical-inventory.empty-title',
          )}
          description={t(
            search.keyword || search.includeInactive
              ? 'stock-events.no-matches-description'
              : 'physical-inventory.empty-description',
          )}
          icon={<ClipboardListIcon />}
          action={
            search.keyword || search.includeInactive ? (
              <Button
                variant="outline"
                onClick={() =>
                  onSearchChange({
                    keyword: undefined,
                    includeInactive: undefined,
                    page: undefined,
                  })
                }
              >
                {t('stock-on-hand.clear-filters')}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function InventoryLoadError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isRefused(error))
    return (
      <DataTableEmpty
        title={t('physical-inventory.no-stock-view-title')}
        description={t('physical-inventory.no-stock-view-description')}
      />
    );
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t('physical-inventory.load-error-title')}
      description={t('physical-inventory.load-error-description')}
    />
  );
}
