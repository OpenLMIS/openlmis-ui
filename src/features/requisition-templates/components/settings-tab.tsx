import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LookupBoundary } from '@/components/dialog-parts';
import { SettingsList } from '@/components/form/settings-list';
import { FieldGroup } from '@/components/ui/field';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { requisitionTemplatesOptions } from '@/features/requisition-templates/api/queries';
import { FacilityTypesFields } from '@/features/requisition-templates/components/facility-types-fields';
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
            <field.TextField
              dir="auto"
              label={t('requisition-templates.configure.name')}
              required
            />
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
          <SettingsFacilityTypes form={form} saved={saved} />
        </LookupBoundary>
      </FieldGroup>
    </div>
  );
}

function SettingsFacilityTypes({ form, saved }: Props) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  const { data: allTypes } = useSuspenseQuery(facilityTypesOptions());
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const selected = useStore(form.store, (state) => state.values.facilityTypeIds);
  return (
    <FacilityTypesFields
      options={eligibleForTemplate(types, templates, saved.program?.id ?? '', saved.id, selected)}
      types={allTypes}
      selected={selected}
      onChange={(ids) => form.setFieldValue('facilityTypeIds', ids)}
      emptyTitle={t('requisition-templates.configure.no-types')}
      emptyDescription={t('requisition-templates.configure.no-types-description')}
    />
  );
}
