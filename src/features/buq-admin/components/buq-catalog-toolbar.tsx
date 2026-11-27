import { PlusIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableAddToolbar } from '@/components/data-table/data-table-add-toolbar';
import { Button } from '@/components/ui/button';
import { DEFAULT_BUQ_CATALOG_SORT } from '@/features/buq-admin/lib/search';
import { BUQ_CATALOGS, type BuqCatalogTab } from '@/features/buq-admin/lib/types';
import { searchSort, type TableSearch } from '@/lib/table-search';

export function BuqCatalogToolbar({
  tab,
  search,
  onSortChange,
  cards,
  onAdd,
  addRef,
  disabled = false,
}: {
  tab: BuqCatalogTab;
  search: TableSearch;
  onSortChange: (patch: Partial<TableSearch>) => void;
  cards: boolean;
  onAdd: (opener: HTMLButtonElement) => void;
  addRef?: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DataTableAddToolbar
      disabled={disabled}
      layout={cards ? 'cards' : 'table'}
      sort={{
        columns: [{ id: 'name', label: t(BUQ_CATALOGS[tab].label) }],
        ...searchSort(search, DEFAULT_BUQ_CATALOG_SORT, onSortChange),
      }}
    >
      <Button
        disabled={disabled}
        onClick={(event) => onAdd(event.currentTarget)}
        ref={addRef}
        size="lg"
        width="full"
      >
        <PlusIcon data-icon="inline-start" />
        {t(tab === 'remarks' ? 'manage-buq.add-remark' : 'manage-buq.add-source')}
      </Button>
    </DataTableAddToolbar>
  );
}
