import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LookupBoundary } from '@/components/display/dialog-parts';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { requisitionTemplatesOptions } from '@/features/requisition-templates/api/queries';
import { FacilityTypesFields } from '@/features/requisition-templates/components/facility-types-fields';
import type { TemplateEditorForm } from '@/features/requisition-templates/components/template-editor';
import { eligibleForTemplate } from '@/features/requisition-templates/lib/eligible-facility-types';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

type Props = { form: TemplateEditorForm; saved: RequisitionTemplate };
type SettingsTabProps = Props & {
  programName: string;
  programError?: string;
  facilityTypesError?: string;
  clearFacilityTypesError: () => void;
};
export function SettingsTab({
  form,
  saved,
  programName,
  programError,
  facilityTypesError,
  clearFacilityTypesError,
}: SettingsTabProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <FieldGroup>
        {programError && (
          <div>
            <SettingsItem label={t('requisition-templates.form.program')}>
              {programName}
            </SettingsItem>
            <FieldError>{programError}</FieldError>
          </div>
        )}
        <form.AppField
          name="name"
          listeners={{
            onChange: ({ fieldApi }) => {
              if (!fieldApi.state.meta.errorMap.onServer) return;
              fieldApi.setMeta((meta) => ({
                ...meta,
                errorMap: { ...meta.errorMap, onServer: undefined },
              }));
            },
          }}
        >
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
          <SettingsFacilityTypes
            form={form}
            saved={saved}
            error={facilityTypesError}
            clearServerError={clearFacilityTypesError}
          />
        </LookupBoundary>
      </FieldGroup>
    </div>
  );
}

function SettingsFacilityTypes({
  form,
  saved,
  error,
  clearServerError,
}: Props & {
  error?: string;
  clearServerError: () => void;
}) {
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
      onChange={(ids) => {
        clearServerError();
        form.setFieldValue('facilityTypeIds', ids);
      }}
      error={error}
      emptyTitle={t('requisition-templates.configure.no-types')}
      emptyDescription={t('requisition-templates.configure.no-types-description')}
    />
  );
}
