import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { toProgramFilter } from '@/features/products/lib/program-filter';
import { PRODUCT_HIDEABLE_COLUMNS, type ProductsSearch } from '@/features/products/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';

type ProductsToolbarProps = {
  search: ProductsSearch;
  onFilterChange: (patch: Partial<ProductsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd?: (() => void) | undefined;
};

export function ProductsToolbar({
  search,
  onFilterChange,
  columnView,
  onAdd,
}: ProductsToolbarProps) {
  const { t } = useTranslation();
  const { data: programs } = useQuery(programsOptions());
  const programFilter = useMemo(
    () => toProgramFilter(programs, search.program),
    [programs, search.program],
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-56">
        <DataTableSearch
          onValueChange={(code) => onFilterChange({ code: code || undefined, page: undefined })}
          placeholder={t('products.search-code')}
          value={search.code ?? ''}
        />
      </div>
      <div className="w-full @2xl/main:w-56">
        <DataTableSearch
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('products.search-name')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-72 @2xl/main:flex-none">
        <DataTableSelectFilter
          label={t('products.program')}
          onValueChange={(program) =>
            onFilterChange({ program: program || undefined, page: undefined })
          }
          options={programFilter.options}
          value={programFilter.value}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={PRODUCT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      {onAdd && (
        <div className="w-full @2xl/main:w-auto">
          <Button onClick={onAdd} width="full">
            <PlusIcon data-icon="inline-start" />
            {t('products.add')}
          </Button>
        </div>
      )}
    </DataTableToolbar>
  );
}
