import { SearchIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppForm } from '@/components/form/form';
import {
  SelectorFrame,
  SelectorSkeletonField,
} from '@/components/pickers/facility-program-selector/facility-program-selector';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { GroupOption } from '@/features/buq/lib/national';
import type { NamedItem } from '@/features/buq/lib/types';

export type NationalDraft = { zone: string | null; period: string };

export function NationalSearchForm({
  groups,
  periods,
  start,
  onDraftChange,
  onSearch,
}: {
  groups: readonly GroupOption[];
  periods: readonly NamedItem[];
  start: NationalDraft;
  onDraftChange: (draft: NationalDraft) => void;
  onSearch: (draft: { zone: string; period: string }) => void;
}) {
  const { t } = useTranslation();
  const form = useAppForm({
    defaultValues: start,
    listeners: { onChange: ({ formApi }) => onDraftChange(formApi.state.values) },
    onSubmit: ({ value }) => {
      if (value.zone && value.period) onSearch({ zone: value.zone, period: value.period });
    },
  });
  useEffect(() => {
    form.reset(start);
  }, [form, start]);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SelectorFrame
        search={
          <form.Subscribe selector={({ values }) => !!values.zone && !!values.period}>
            {(ready) => (
              <Button disabled={!ready} size="lg" type="submit">
                <SearchIcon data-icon="inline-start" />
                {t('facility-program.search')}
              </Button>
            )}
          </form.Subscribe>
        }
      >
        <form.AppField name="zone">
          {(field) => (
            <field.ComboboxField
              clearLabel={t('buq.national.clear-group')}
              emptyMessage={t('buq.national.no-groups')}
              items={groups}
              label={t('buq.national.group')}
              limit={-1}
              placeholder={t('buq.national.group-placeholder')}
              required
              size="lg"
            />
          )}
        </form.AppField>
        <form.AppField name="period">
          {(field) => (
            <field.SelectField
              items={periods.map(({ id, name }) => ({ value: id, label: name }))}
              label={t('buq.approve.period')}
              placeholder={t('buq.national.period-placeholder')}
              required
              size="lg"
            />
          )}
        </form.AppField>
      </SelectorFrame>
    </form>
  );
}

export function NationalSearchSkeleton() {
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
        <SelectorSkeletonField label={t('buq.national.group')} />
        <SelectorSkeletonField label={t('buq.approve.period')} />
      </SelectorFrame>
    </div>
  );
}
