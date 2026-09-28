import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';

export function ServiceAccountsToolbar({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:ms-auto @2xl/main:w-auto">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('service-accounts.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
