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
  const programOptions = useProgramOptions(search.program);

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-48">
        <DataTableSearch
          label={t('products.filter-code')}
          onValueChange={(code) => onFilterChange({ code: code || undefined, page: undefined })}
          placeholder={t('products.filter-code')}
          value={search.code ?? ''}
        />
      </div>
      <div className="w-full @2xl/main:w-64">
        <DataTableSearch
          label={t('products.filter-name')}
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('products.filter-name')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-56 @2xl/main:flex-none">
        <DataTableSelectFilter
          label={t('products.program')}
          onValueChange={(program) =>
            onFilterChange({ program: program || undefined, page: undefined })
          }
          options={programOptions}
          value={search.program ?? ''}
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

function useProgramOptions(selected: string | undefined) {
  const { data: programs } = useQuery(programsOptions());
  return useMemo(() => {
    const options = (programs ?? [])
      .map((program) => ({ value: program.code, label: program.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const known = options.some((option) => option.value === selected);
    return selected && !known ? [{ value: selected, label: selected }, ...options] : options;
  }, [programs, selected]);
}
