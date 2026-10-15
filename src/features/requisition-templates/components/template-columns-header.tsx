import { useTranslation } from 'react-i18next';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TemplateColumnsHeader() {
  const { t } = useTranslation();
  return (
    <>
      <TemplateColumnsColgroup />
      <TableHeader surface="muted">
        <TableRow>
          <TableHead>
            <span className="sr-only">{t('requisition-templates.configure.move-header')}</span>
          </TableHead>
          <TableHead>
            <DataTableHeaderLabel>
              {t('requisition-templates.configure.display')}
            </DataTableHeaderLabel>
          </TableHead>
          <TableHead>
            <span className="sr-only">{t('requisition-templates.configure.indicator')}</span>
          </TableHead>
          <TableHead>
            <DataTableHeaderLabel>
              {t('requisition-templates.configure.label')}
            </DataTableHeaderLabel>
          </TableHead>
          <TableHead>
            <DataTableHeaderLabel>
              {t('requisition-templates.configure.definition')}
            </DataTableHeaderLabel>
          </TableHead>
          <TableHead>
            <DataTableHeaderLabel>
              {t('requisition-templates.configure.source')}
            </DataTableHeaderLabel>
          </TableHead>
          <TableHead>
            <DataTableHeaderLabel>
              {t('requisition-templates.configure.additional-options')}
            </DataTableHeaderLabel>
          </TableHead>
        </TableRow>
      </TableHeader>
    </>
  );
}

export function TemplateColumnsColgroup() {
  return (
    <colgroup>
      <col className="w-10" />
      <col className="w-18" />
      <col className="w-12" />
      <col className="w-56" />
      <col className="w-72" />
      <col className="w-44" />
      <col className="w-68" />
    </colgroup>
  );
}
