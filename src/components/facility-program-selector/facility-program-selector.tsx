import { revalidateLogic, useStore } from '@tanstack/react-form';
import type { ParseKeys } from 'i18next';
import { SearchIcon } from 'lucide-react';
import { Children, memo, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { FieldLabelText } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type CompleteSelection,
  changeMode,
  changeProgram,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  initialSelection,
  recordLabel,
  sameSelection,
} from '@/lib/facility-program-selection';

const errorKey = (key: ParseKeys) => key;

const selectionSchema = z.object({
  mode: z.enum(['my', 'supervised']),
  programId: z.string().min(1, errorKey('facility-program.program-required')),
  facilityId: z.string().min(1, errorKey('facility-program.facility-required')),
});

function toValues(selection: FacilityProgramSelection): CompleteSelection {
  return {
    mode: selection.mode ?? 'supervised',
    programId: selection.programId ?? '',
    facilityId: selection.facilityId ?? '',
  };
}

const fromValues = (values: CompleteSelection): FacilityProgramSelection => ({
  mode: values.mode,
  programId: values.programId || undefined,
  facilityId: values.facilityId || undefined,
});

type FacilityProgramSelectorProps = {
  options: FacilityProgramOptions;
  /** The selection last searched for, from the URL; the picker starts from it and returns to it when it changes. */
  applied: FacilityProgramSelection;
  onSearch: (selection: CompleteSelection) => void;
  onDraftChange: (draft: FacilityProgramSelection) => void;
};

/** Legacy's facility and program picker: my facility or one supervised, then a program the right is granted for there. */
export const FacilityProgramSelector = memo(function FacilityProgramSelector({
  options,
  applied,
  onSearch,
  onDraftChange,
}: FacilityProgramSelectorProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const start = toValues(initialSelection(applied, options));
  const form = useAppForm({
    defaultValues: start,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: selectionSchema },
    listeners: { onChange: ({ formApi }) => onDraftChange(fromValues(formApi.state.values)) },
    onSubmit: ({ value, formApi }) => {
      onSearch(value);
      // A new search starts fresh, so the next change marks nothing missing until Search.
      formApi.reset(value);
    },
    onSubmitInvalid: () =>
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  });
  const mode = useStore(form.store, (state) => state.values.mode);
  const programId = useStore(form.store, (state) => state.values.programId);

  // Back, Forward or a link brings another selection; the picker follows it.
  const { mode: startMode, programId: startProgram, facilityId: startFacility } = start;
  useEffect(() => {
    const next = { mode: startMode, programId: startProgram, facilityId: startFacility };
    if (!sameSelection(form.state.values, next)) form.reset(next);
  }, [form, startMode, startProgram, startFacility]);

  const apply = (selection: FacilityProgramSelection) => {
    const values = toValues(selection);
    form.setFieldValue('programId', values.programId);
    form.setFieldValue('facilityId', values.facilityId);
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
      listeners={{
        onChange: ({ value }) =>
          form.setFieldValue(
            'facilityId',
            toValues(changeProgram(fromValues(form.state.values), value || undefined, options))
              .facilityId,
          ),
      }}
      name="programId"
    >
      {(field) =>
        programItems.length > 0 ? (
          <field.SelectField items={programItems} label={t('facility-program.program')} required />
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

  const facilityField =
    mode === 'my' ? (
      <form.AppField name="facilityId">
        {(field) =>
          options.home ? (
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
    ) : (
      <form.AppField name="facilityId">
        {(field) => (
          <field.ComboboxField
            clearLabel={t('facility-program.clear-facility')}
            description={programId ? undefined : t('facility-program.facility-after-program')}
            disabled={!programId}
            emptyMessage={t('facility-program.no-facilities')}
            items={facilityItems}
            label={t('facility-program.facility')}
            limit={-1}
            placeholder={t('facility-program.facility-placeholder')}
            required
          />
        )}
      </form.AppField>
    );

  return (
    <form
      noValidate
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SelectorFrame
        mode={
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
                    disabled: !options.home,
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
        }
        search={
          <Button type="submit">
            <SearchIcon data-icon="inline-start" />
            {t('facility-program.search')}
          </Button>
        }
      >
        {mode === 'my' ? facilityField : programField}
        {mode === 'my' ? programField : facilityField}
      </SelectorFrame>
    </form>
  );
});

function NoOptions({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-sm">
        <FieldLabelText label={label} />
      </span>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

type SelectorFrameProps = {
  mode: ReactNode;
  children: ReactNode;
  search: ReactNode;
};

function SelectorFrame({ mode, children, search }: SelectorFrameProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4 @3xl/main:flex-row @3xl/main:items-start">
          <div className="shrink-0">{mode}</div>
          {Children.map(children, (field) => (
            <div className="min-w-0 flex-1">{field}</div>
          ))}
          <div className="flex flex-col gap-1">
            <span aria-hidden className="invisible hidden text-sm leading-snug @3xl/main:block">
              &nbsp;
            </span>
            {search}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FacilityProgramSelectorSkeleton() {
  const { t } = useTranslation();
  const field = (label: string) => (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-sm leading-snug">
        <FieldLabelText label={label} required />
      </span>
      <div className="h-8">
        <Skeleton fill />
      </div>
    </div>
  );
  return (
    <div aria-busy>
      <SelectorFrame
        mode={
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm leading-snug">{t('facility-program.mode')}</span>
            <div className="h-8 w-64">
              <Skeleton fill />
            </div>
          </div>
        }
        search={
          <div className="h-8 w-24">
            <Skeleton fill />
          </div>
        }
      >
        {field(t('facility-program.facility'))}
        {field(t('facility-program.program'))}
      </SelectorFrame>
    </div>
  );
}
