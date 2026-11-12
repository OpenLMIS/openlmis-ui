import { revalidateLogic } from '@tanstack/react-form';
import { SearchIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import {
  SelectorFrame,
  SelectorSkeletonField,
} from '@/components/pickers/facility-program-selector/facility-program-selector';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PodListSearch } from '@/features/orders/lib/pod-search';

export type PodSelection = Pick<
  PodListSearch,
  'programId' | 'requestingFacilityId' | 'supplyingFacilityId'
>;
type Option = { id: string; name: string | null };
const schema = z
  .object({
    programId: z.string().nullable().refine(Boolean, 'orders.required'),
    requestingFacilityId: z.string().nullable(),
    supplyingFacilityId: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (!value.requestingFacilityId && !value.supplyingFacilityId)
      for (const path of ['requestingFacilityId', 'supplyingFacilityId'])
        context.addIssue({ code: 'custom', path: [path], message: 'orders.required' });
  });
export function PodSearchPicker({
  applied,
  requesting,
  supplying,
  programs,
  onDraftChange,
  onSearch,
}: {
  applied: PodSelection;
  requesting: Option[];
  supplying: Option[];
  programs: Option[];
  onDraftChange: (value: PodSelection) => void;
  onSearch: (value: PodSelection) => void;
}) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useAppForm({
    defaultValues: {
      programId: (applied.programId ?? '') as string | null,
      requestingFacilityId: (applied.requestingFacilityId ?? '') as string | null,
      supplyingFacilityId: (applied.supplyingFacilityId ?? '') as string | null,
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    listeners: {
      onChange: ({ formApi }) => {
        const v = formApi.state.values;
        onDraftChange({
          programId: v.programId || undefined,
          requestingFacilityId: v.requestingFacilityId || undefined,
          supplyingFacilityId: v.supplyingFacilityId || undefined,
        });
      },
    },
    onSubmit: ({ value }) =>
      onSearch({
        programId: value.programId || undefined,
        requestingFacilityId: value.requestingFacilityId || undefined,
        supplyingFacilityId: value.supplyingFacilityId || undefined,
      }),
    onSubmitInvalid: () => {
      toast.error(t('orders.pod.invalid-form'), {
        description: t('orders.pod.search-invalid-description'),
      });
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });
  const fields = [
    {
      name: 'requestingFacilityId',
      label: t('orders.pod.requesting-facility'),
      options: requesting,
    },
    { name: 'supplyingFacilityId', label: t('orders.pod.supplying-facility'), options: supplying },
    { name: 'programId', label: t('orders.pod.program'), options: programs },
  ] as const;
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SelectorFrame
        search={
          <Button size="lg" type="submit">
            <SearchIcon data-icon="inline-start" />
            {t('facility-program.search')}
          </Button>
        }
      >
        {fields
          .filter((field) => field.name === 'programId' || field.options.length > 0)
          .map(({ name, label, options }) => (
            <form.AppField key={name} name={name}>
              {(field) => (
                <field.ComboboxField
                  label={label}
                  placeholder={t('orders.pod.select', { label })}
                  clearLabel={t('orders.pod.clear', { label })}
                  emptyMessage={t('orders.no-options')}
                  virtualized
                  size="lg"
                  required={name === 'programId'}
                  items={options.map((option) => ({
                    value: option.id,
                    label: option.name ?? option.id,
                  }))}
                />
              )}
            </form.AppField>
          ))}
      </SelectorFrame>
    </form>
  );
}
export function PodSearchPickerSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <SelectorFrame
        search={
          <div className="h-9 w-24">
            <Skeleton fill />
          </div>
        }
      >
        {(
          [
            'orders.pod.requesting-facility',
            'orders.pod.supplying-facility',
            'orders.pod.program',
          ] as const
        ).map((key) => (
          <SelectorSkeletonField key={key} label={t(key)} />
        ))}
      </SelectorFrame>
    </div>
  );
}
