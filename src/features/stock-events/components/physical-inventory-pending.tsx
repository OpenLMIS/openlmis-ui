import { useQuery } from '@tanstack/react-query';
import type { ColumnVisibilityState } from '@tanstack/react-table';
import { PlusIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { DraftStatusSkeleton } from '@/components/display/draft-status';
import { QuantityUnitToggle } from '@/components/pickers/quantity-unit-toggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { WorkspaceFooterPortal } from '@/components/workspace/workspace-tabs';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  inventoryHideableColumns,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';
import { inventoryOptionalColumns } from '@/features/stock-events/lib/physical-inventory-products';
import type { InventorySearch } from '@/features/stock-events/lib/physical-inventory-search';
import type { PhysicalInventoryDraft } from '@/features/stock-events/lib/physical-inventory-types';
import { columnChoicesSchema, useCardLayout } from '@/hooks/use-card-view';
import type { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useStoredState } from '@/hooks/use-stored-state';
import type { SearchChange } from '@/lib/table-search';

type QuantityUnitState = ReturnType<typeof useQuantityUnit>;
type ToolbarProps = {
  search: InventorySearch;
  onSearchChange?: SearchChange<InventorySearch>;
  quantityUnit: QuantityUnitState;
  view: ReturnType<typeof useColumnVisibility>;
  progress: ReactNode;
  save: ReactNode;
  onAdd?: () => void;
  disabled?: boolean;
  cards?: boolean;
};

export function InventoryToolbar({
  search,
  onSearchChange,
  quantityUnit,
  view,
  progress,
  save,
  onAdd,
  disabled,
  cards = false,
}: ToolbarProps) {
  const { t } = useTranslation();
  const inactiveId = useId();
  return (
    <DataTableToolbar>
      <div className="flex w-full flex-wrap items-end gap-2 @4xl/main:w-auto @4xl/main:flex-nowrap">
        <div className="min-w-0 flex-1 @4xl/main:w-80 @4xl/main:flex-none">{progress}</div>
        <div className="shrink-0">
          <DataTableFilters
            size="lg"
            activeCount={[search.keyword, search.includeInactive].filter(Boolean).length}
            disabled={disabled}
            onClear={() =>
              onSearchChange?.({ keyword: undefined, includeInactive: undefined, page: undefined })
            }
          >
            <DataTableSearch
              disabled={disabled}
              maxLength={50}
              onValueChange={(value) =>
                onSearchChange?.({ keyword: value.trim() || undefined, page: undefined }, true)
              }
              placeholder={t('stock-events.keywords')}
              value={search.keyword ?? ''}
            />
            <label htmlFor={inactiveId} className="flex items-center gap-2 text-sm">
              <Switch
                id={inactiveId}
                checked={search.includeInactive ?? false}
                onCheckedChange={(checked) =>
                  onSearchChange?.({ includeInactive: checked || undefined, page: undefined })
                }
              />
              {t('physical-inventory.include-inactive')}
            </label>
          </DataTableFilters>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 @4xl/main:ms-auto @4xl/main:w-auto">
        <div className="basis-full @4xl/main:basis-auto">{save}</div>
        {quantityUnit.canSwitch && (
          <div className="flex-1 @4xl/main:flex-none">
            <QuantityUnitToggle
              disabled={disabled}
              unit={quantityUnit.unit}
              onUnitChange={quantityUnit.setUnit}
            />
          </div>
        )}
        <div className={quantityUnit.canSwitch ? 'shrink-0' : 'flex-1 @4xl/main:flex-none'}>
          <DataTableViewOptions
            size="lg"
            disabled={disabled}
            layout={cards ? 'cards' : 'table'}
            columns={INVENTORY_HIDEABLE_COLUMNS.filter(
              (column) => !cards || column.id !== 'productCode',
            ).map((column) => ({
              id: column.id,
              label: t(column.labelKey),
            }))}
            {...view}
          />
        </div>
        <div className="w-full @4xl/main:w-auto">
          <Button size="lg" disabled={disabled} onClick={onAdd} width="full">
            <PlusIcon data-icon="inline-start" />
            {t('physical-inventory.add-product')}
          </Button>
        </div>
      </div>
    </DataTableToolbar>
  );
}

export function PhysicalInventoryPendingBody({
  search,
  visibility,
  showVvm: providedVvm,
  showActions: providedActions,
  draft,
  quantityUnit,
}: {
  search: InventorySearch;
  visibility?: ColumnVisibilityState;
  draft?: PhysicalInventoryDraft;
  showVvm?: boolean;
  showActions?: boolean;
  quantityUnit: QuantityUnitState;
}) {
  const { t } = useTranslation();
  const scope = draft ?? { id: '', facilityId: '', programId: '', lineItems: [] };
  const { data: stock } = useQuery({ ...inventoryStockLinesOptions(scope), enabled: false });
  const { data: eligible } = useQuery({
    ...eligibleInventoryProductsOptions(scope),
    enabled: false,
  });
  const optionalColumns = inventoryOptionalColumns(
    eligible ?? [],
    buildInventoryLines(stock ?? [], draft?.lineItems ?? []),
  );
  const showVvm = providedVvm ?? optionalColumns.showVvm;
  const showActions = providedActions ?? optionalColumns.showActions;
  const { measure, width, cards } = useCardLayout<HTMLDivElement>();
  const choices = useStoredState('physical-inventory.columns', columnChoicesSchema, {});
  const view = useColumnVisibility(
    inventoryHideableColumns({ showVvm, showActions, unit: quantityUnit.unit }, choices[0]),
    choices,
    cards ? undefined : width,
  );
  const columns = visibility ?? view.visibility;
  return (
    <div className="flex min-w-0 flex-col gap-4" ref={measure} aria-busy="true">
      <InventoryToolbar
        cards={cards}
        search={search}
        quantityUnit={quantityUnit}
        view={{ ...view, visibility: columns }}
        disabled
        progress={
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <div className="h-4 w-40">
                <Skeleton fill />
              </div>
              <div className="h-4 w-8">
                <Skeleton fill />
              </div>
            </div>
            <div className="h-1 w-full">
              <Skeleton fill />
            </div>
          </div>
        }
        save={<DraftStatusSkeleton />}
      />
      <PhysicalInventoryGridSkeleton
        cards={cards}
        visibility={columns}
        showVvm={showVvm}
        showActions={showActions}
        unit={quantityUnit.unit}
      />
      <WorkspaceFooterPortal width="wide">
        <Button size="lg" variant="destructive" disabled>
          {t('physical-inventory.delete')}
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" variant="outline" disabled>
            {t('physical-inventory.save')}
          </Button>
          <Button size="lg" disabled>
            {t('stock-events.submit')}
          </Button>
        </div>
      </WorkspaceFooterPortal>
    </div>
  );
}
