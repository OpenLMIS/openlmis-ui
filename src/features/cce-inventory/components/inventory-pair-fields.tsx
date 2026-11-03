import { useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { FieldLabelText } from '@/components/form/form-fields';
import type { SectionProps } from '@/features/cce-inventory/components/inventory-item-sections';
import {
  changeMode,
  changeProgram,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  recordLabel,
} from '@/lib/facility-program-selection';

export function PairFields({ form, options }: SectionProps & { options: FacilityProgramOptions }) {
  const { t } = useTranslation();
  const mode = useStore(form.store, (state) => state.values.mode);
  const programId = useStore(form.store, (state) => state.values.programId);

  const selection = (): FacilityProgramSelection => ({
    mode: form.state.values.mode,
    programId: form.state.values.programId ?? undefined,
    facilityId: form.state.values.facilityId ?? undefined,
  });
  const apply = (next: FacilityProgramSelection) => {
    form.setFieldValue('programId', next.programId ?? null);
    form.setFieldValue('facilityId', next.facilityId ?? null);
  };

  const programs = mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  const programItems = programs.map((program) => ({
    value: program.id,
    label: recordLabel(program),
  }));
  const facilityItems = programId
    ? options.facilitiesFor(programId).map((facility) => ({
        value: facility.id,
        label: recordLabel(facility),
        description: facility.code,
      }))
    : [];

  return (
    <>
      <div className="@3xl/main:col-span-2">
        <form.AppField
          listeners={{ onChange: ({ value }) => apply(changeMode(value, options)) }}
          name="mode"
        >
          {(field) => (
            <field.RadioGroupField
              label={t('facility-program.mode')}
              options={[
                {
                  value: 'my',
                  label: t('facility-program.my-facility'),
                  disabled: !options.home || options.myPrograms.length === 0,
                },
                {
                  value: 'supervised',
                  label: t('facility-program.supervised-facility'),
                  disabled: options.supervisedPrograms.length === 0,
                },
              ]}
              variant="segmented"
            />
          )}
        </form.AppField>
      </div>
      <form.AppField
        listeners={{
          onChange: ({ value }) =>
            form.setFieldValue(
              'facilityId',
              changeProgram(selection(), value ?? undefined, options).facilityId ?? null,
            ),
        }}
        name="programId"
      >
        {(field) =>
          programItems.length > 0 ? (
            <field.ComboboxField
              clearLabel={t('facility-program.clear-program')}
              emptyMessage={t('facility-program.no-programs')}
              items={programItems}
              label={t('facility-program.program')}
              limit={-1}
              placeholder={t('facility-program.program-placeholder')}
              required
            />
          ) : (
            <NoOptions
              label={t('facility-program.program')}
              message={t(
                mode === 'my'
                  ? 'facility-program.no-home-programs'
                  : 'facility-program.no-supervised-programs',
              )}
            />
          )
        }
      </form.AppField>
      <form.AppField name="facilityId">
        {(field) =>
          mode !== 'my' ? (
            <field.ComboboxField
              clearLabel={t('facility-program.clear-facility')}
              disabled={!programId}
              emptyMessage={t('facility-program.no-facilities')}
              items={facilityItems}
              label={t('facility-program.facility')}
              limit={-1}
              placeholder={
                programId
                  ? t('facility-program.facility-placeholder')
                  : t('facility-program.facility-after-program')
              }
              required
            />
          ) : options.home ? (
            <field.SelectField
              disabled
              items={[{ value: options.home.id, label: recordLabel(options.home) }]}
              label={t('facility-program.facility')}
              required
            />
          ) : (
            <NoOptions
              label={t('facility-program.facility')}
              message={t('facility-program.no-home')}
            />
          )
        }
      </form.AppField>
    </>
  );
}

function NoOptions({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-sm">
        <FieldLabelText label={label} required />
      </span>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
