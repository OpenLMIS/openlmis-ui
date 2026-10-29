import { revalidateLogic } from '@tanstack/react-form';
import { SearchIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  SelectorFrame,
  SelectorSkeletonField,
} from '@/components/facility-program-selector/facility-program-selector';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SearchFacility } from '@/features/requisitions/lib/search-facilities';
import { recordLabel } from '@/lib/facility-program-selection';

const schema = z.object({ facility: z.string().min(1, 'facility-program.facility-required') });

export function RequisitionSearchPicker({
  options,
  applied,
  onDraftChange,
  onSearch,
}: {
  options: SearchFacility[];
  applied?: string;
  onDraftChange: (facility: string) => void;
  onSearch: (facility: string) => void;
}) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const start = options.some(({ id }) => id === applied)
    ? applied
    : !applied && options.length === 1
      ? options[0]?.id
      : '';
  const form = useAppForm({
    defaultValues: { facility: start ?? '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    listeners: { onChange: ({ formApi }) => onDraftChange(formApi.state.values.facility) },
    onSubmit: ({ value, formApi }) => {
      onSearch(value.facility);
      formApi.reset(value);
    },
    onSubmitInvalid: () =>
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  });
  useEffect(() => {
    form.reset({ facility: start ?? '' });
  }, [form, start]);
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
        search={
          <Button disabled={options.length === 0} size="lg" type="submit">
            <SearchIcon data-icon="inline-start" />
            {t('facility-program.search')}
          </Button>
        }
      >
        <form.AppField name="facility">
          {(field) => (
            <field.ComboboxField
              clearLabel={t('facility-program.clear-facility')}
              emptyMessage={t('requisitions.view.no-facilities')}
              items={options.map((facility) => ({
                value: facility.id,
                label: recordLabel(facility),
                description: facility.code,
              }))}
              label={t('facility-program.facility')}
              limit={-1}
              placeholder={t('facility-program.facility-placeholder')}
              required
              size="lg"
            />
          )}
        </form.AppField>
      </SelectorFrame>
    </form>
  );
}

export function RequisitionSearchPickerSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <SelectorFrame
        search={
          <div className="h-9 w-full @3xl/main:w-24">
            <Skeleton fill />
          </div>
        }
      >
        <SelectorSkeletonField label={t('facility-program.facility')} />
      </SelectorFrame>
    </div>
  );
}
