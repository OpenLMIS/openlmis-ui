import { useQuery } from '@tanstack/react-query';
import type { ColumnVisibilityState } from '@tanstack/react-table';
import { FilterIcon, PlusIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
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
import type { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useStoredState } from '@/hooks/use-stored-state';
import type { SearchChange } from '@/lib/table-search';

const choicesSchema = z.record(z.string(), z.boolean());
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
}: ToolbarProps) {
  const { t } = useTranslation();
  const inactiveId = useId();
  const count = [search.keyword, search.includeInactive].filter(Boolean).length;
  return (
    <DataTableToolbar>
      <div className="flex w-full items-end gap-3 @4xl/main:w-auto">
        <div className="min-w-0 flex-1 @4xl/main:w-52 @4xl/main:flex-none">{progress}</div>
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} />}>
            <FilterIcon data-icon="inline-start" />
            {t('stock-on-hand.filter')}
            {count > 0 && (
              <>
                <Badge aria-hidden variant="secondary">
                  {count}
                </Badge>
                <span className="sr-only">{t('stock-on-hand.active-filters', { count })}</span>
              </>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" aria-label={t('stock-on-hand.filter')} side="top">
            <div className="flex flex-col gap-3">
              <Input
                aria-label={t('stock-events.keywords')}
                placeholder={t('stock-events.keywords')}
                maxLength={50}
                value={search.keyword ?? ''}
                onChange={(event) =>
                  onSearchChange?.(
                    { keyword: event.target.value || undefined, page: undefined },
                    true,
                  )
                }
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
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 @4xl/main:ms-auto @4xl/main:w-auto">
        <div className="basis-full @4xl/main:basis-auto">{save}</div>
        <div className="shrink-0">
          <DataTableViewOptions
            disabled={disabled}
            columns={INVENTORY_HIDEABLE_COLUMNS.map((column) => ({
              id: column.id,
              label: t(column.labelKey),
            }))}
            {...view}
          />
        </div>
        <div className="flex-1 @4xl/main:flex-none">
          <Button disabled={disabled} onClick={onAdd} width="full">
            <PlusIcon data-icon="inline-start" />
            {t('physical-inventory.add-product')}
          </Button>
        </div>
        {quantityUnit.canSwitch && (
          <QuantityUnitToggle
            disabled={disabled}
            unit={quantityUnit.unit}
            onUnitChange={quantityUnit.setUnit}
          />
        )}
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
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const choices = useStoredState('physical-inventory.columns', choicesSchema, {});
  const view = useColumnVisibility(
    inventoryHideableColumns({ showVvm, showActions, unit: quantityUnit.unit }, choices[0]),
    choices,
    width,
  );
  const columns = visibility ?? view.visibility;
  return (
    <div className="flex min-w-0 flex-col gap-4" ref={measure} aria-busy="true">
      <InventoryToolbar
        search={search}
        quantityUnit={quantityUnit}
        view={{ ...view, visibility: columns }}
        disabled
        progress={
          <div className="flex w-full flex-col gap-1">
            <div className="h-4 w-full">
              <Skeleton fill />
            </div>
            <div className="h-1 w-full">
              <Skeleton fill />
            </div>
            <div className="h-4 w-8">
              <Skeleton fill />
            </div>
          </div>
        }
        save={
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-hidden>
            <div className="size-4 shrink-0">
              <Skeleton fill />
            </div>
            <span className="relative">
              <span className="invisible">{t('physical-inventory.saved-local')}</span>
              <span className="absolute inset-0">
                <Skeleton fill />
              </span>
            </span>
          </div>
        }
      />
      <PhysicalInventoryGridSkeleton
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
