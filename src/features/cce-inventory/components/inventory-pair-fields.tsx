import { useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { FieldLabelText } from '@/components/form/form-fields';
import { Field, FieldDescription, FieldTitle } from '@/components/ui/field';
import type { FormProps } from '@/features/cce-inventory/components/inventory-item-sections';
import {
  changeMode,
  changeProgram,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  recordLabel,
} from '@/lib/facility-program-selection';

export function PairFields({ form, options }: FormProps & { options: FacilityProgramOptions }) {
  const { t } = useTranslation();
  const mode = useStore(form.store, (state) => state.values.pair.mode);
  const programId = useStore(form.store, (state) => state.values.pair.programId);

  const selection = (): FacilityProgramSelection => ({
    mode: form.state.values.pair.mode,
    programId: form.state.values.pair.programId ?? undefined,
    facilityId: form.state.values.pair.facilityId ?? undefined,
  });
  const apply = (next: FacilityProgramSelection) => {
    form.setFieldValue('pair.programId', next.programId ?? null);
    form.setFieldValue('pair.facilityId', next.facilityId ?? null);
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

  const programField = (
    <form.AppField
      key="program"
      listeners={{
        onChange: ({ value }) =>
          form.setFieldValue(
            'pair.facilityId',
            changeProgram(selection(), value ?? undefined, options).facilityId ?? null,
          ),
      }}
      name="pair.programId"
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
  );

  const facilityField = (
    <form.AppField key="facility" name="pair.facilityId">
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
  );

  return (
    <>
      <div className="@3xl/item:col-span-2">
        <form.AppField
          listeners={{ onChange: ({ value }) => apply(changeMode(value, options)) }}
          name="pair.mode"
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
      {mode === 'my' ? facilityField : programField}
      {mode === 'my' ? programField : facilityField}
    </>
  );
}

function NoOptions({ label, message }: { label: string; message: string }) {
  return (
    <Field>
      <FieldTitle>
        <FieldLabelText label={label} required />
      </FieldTitle>
      <FieldDescription>{message}</FieldDescription>
    </Field>
  );
}
