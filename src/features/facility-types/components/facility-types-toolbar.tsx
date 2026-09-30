import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { FACILITY_TYPE_HIDEABLE_COLUMNS } from '@/features/facility-types/lib/search';

type FacilityTypesToolbarProps = {
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function FacilityTypesToolbar({ columnView, onAdd }: FacilityTypesToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={FACILITY_TYPE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="w-full @2xl/main:w-auto">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('facility-types.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
