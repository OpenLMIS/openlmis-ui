import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { LookupBoundary } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { SettingsList } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { requisitionTemplatesOptions } from '@/features/requisition-templates/api/queries';
import type { TemplateEditorForm } from '@/features/requisition-templates/components/template-editor';
import { eligibleForTemplate } from '@/features/requisition-templates/lib/eligible-facility-types';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

type Props = { form: TemplateEditorForm; saved: RequisitionTemplate };
export function SettingsTab({ form, saved }: Props) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <FieldGroup>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label={t('requisition-templates.configure.name')} required />
          )}
        </form.AppField>
        <SettingsList>
          <form.AppField name="rejectionReasonWindowVisible">
            {(field) => (
              <field.SwitchField
                layout="row"
                label={t('requisition-templates.configure.rejection')}
                description={t('requisition-templates.configure.rejection-help')}
              />
            )}
          </form.AppField>
          <form.AppField name="requisitionReportOnly">
            {(field) => (
              <field.SwitchField
                layout="row"
                label={t('requisition-templates.configure.report-only')}
                description={t('requisition-templates.configure.report-only-help')}
              />
            )}
          </form.AppField>
          <form.AppField name="patientsTabEnabled">
            {(field) => (
              <field.SwitchField
                layout="row"
                label={t('requisition-templates.configure.patients')}
                description={t('requisition-templates.configure.patients-help')}
              />
            )}
          </form.AppField>
        </SettingsList>
        <LookupBoundary
          label={t('requisition-templates.configure.facility-type')}
          errorTitle={t('requisition-templates.form.lookup-error')}
          errorDescription={t('error.check-connection')}
        >
          <FacilityTypesFields form={form} saved={saved} />
        </LookupBoundary>
      </FieldGroup>
    </div>
  );
}

function FacilityTypesFields({ form, saved }: Props) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  const { data: allTypes } = useSuspenseQuery(facilityTypesOptions());
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const selected = useStore(form.store, (state) => state.values.facilityTypeIds);
  const picker = useAppForm({ defaultValues: { facilityTypeId: null as string | null } });
  const pickedId = useStore(picker.store, (state) => state.values.facilityTypeId);
  const options = eligibleForTemplate(
    types,
    templates,
    saved.program?.id ?? '',
    saved.id,
    selected,
  );
  const names = new Map(allTypes.map((type) => [type.id, facilityTypeName(type)]));
  const rows = selected
    .map((id) => ({ id, name: names.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const picked = options.some(({ id }) => id === pickedId);
  const tableRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const remove = (id: string, index: number) => {
    form.setFieldValue('facilityTypeIds', (ids) => ids.filter((value) => value !== id));
    requestAnimationFrame(() => {
      const buttons = tableRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-type]');
      (
        buttons?.[Math.min(index, buttons.length - 1)] ??
        pickerRef.current?.querySelector<HTMLInputElement>('input')
      )?.focus();
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1" ref={pickerRef}>
          <picker.AppField name="facilityTypeId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('requisition-templates.form.clear-facility-type')}
                emptyMessage={t('requisition-templates.form.no-types-left')}
                items={options.map((type) => ({ value: type.id, label: facilityTypeName(type) }))}
                label={t('requisition-templates.configure.facility-type')}
                placeholder={t('requisition-templates.form.pick-facility-type')}
              />
            )}
          </picker.AppField>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (pickedId && picked) {
              form.pushFieldValue('facilityTypeIds', pickedId);
              picker.setFieldValue('facilityTypeId', null);
            }
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {t('requisition-templates.configure.add')}
        </Button>
      </div>
      <div ref={tableRef}>
        <DataTableCard>
          <Table density="comfortable">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t('requisition-templates.configure.facility-type')}
                  </DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t('requisition-templates.configure.remove')}
                  </DataTableHeaderLabel>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span dir="auto">{row.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          data-remove-type
                          aria-label={t('requisition-templates.form.remove-type', {
                            type: row.name,
                          })}
                          onClick={() => remove(row.id, index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
                    <DataTableEmpty title={t('requisition-templates.configure.no-types')} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>
    </div>
  );
}
