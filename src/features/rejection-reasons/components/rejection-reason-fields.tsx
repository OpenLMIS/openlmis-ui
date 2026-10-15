import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LookupBoundary } from '@/components/dialog-parts';
import { withForm } from '@/components/form/form';
import type { SelectFieldItem } from '@/components/form/form-fields';
import { rejectionReasonCategoriesOptions } from '@/features/reference-data/api/queries';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { EMPTY_REASON_FORM } from '@/features/rejection-reasons/lib/reason-form';

type FieldProps = { disabled?: boolean; saved?: RejectionReason };

export const RejectionReasonFields = withForm({
  defaultValues: EMPTY_REASON_FORM,
  props: {} as FieldProps,
  render: function Render({ form, disabled, saved }) {
    const { t } = useTranslation();
    return (
      <>
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="auto"
              disabled={disabled}
              label={t('rejection-reasons.name')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="code">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="ltr"
              disabled={disabled}
              label={t('rejection-reasons.code')}
              required
            />
          )}
        </form.AppField>
        <LookupBoundary
          label={t('rejection-reasons.category')}
          required
          errorTitle={t('rejection-reasons.form.category-load-error-title')}
          errorDescription={t('rejection-reasons.form.category-load-error-description')}
        >
          <RejectionReasonCategorySelect form={form} disabled={disabled} saved={saved} />
        </LookupBoundary>
        <form.AppField name="active">
          {(field) => (
            <field.SwitchField disabled={disabled} label={t('rejection-reasons.active')} />
          )}
        </form.AppField>
      </>
    );
  },
});

const RejectionReasonCategorySelect = withForm({
  defaultValues: EMPTY_REASON_FORM,
  props: {} as FieldProps,
  render: function Render({ form, disabled, saved }) {
    const { t } = useTranslation();
    const {
      data: categories,
      error,
      isFetching,
    } = useSuspenseQuery(rejectionReasonCategoriesOptions());
    const categoryId = useStore(form.store, (state) => state.values.categoryId);
    if (error && !isFetching) throw error;
    const items: SelectFieldItem[] = categories.map((category) => ({
      value: category.id,
      label: category.active
        ? category.name
        : t('rejection-reasons.form.category-inactive', { name: category.name }),
    }));
    const missing =
      Boolean(categoryId) && !categories.some((category) => category.id === categoryId);
    if (missing && saved?.rejectionReasonCategory.id === categoryId) {
      items.push({
        value: categoryId,
        label: t('rejection-reasons.form.category-missing', {
          name: saved.rejectionReasonCategory.name,
        }),
        disabled: true,
      });
    }
    return (
      <form.AppField name="categoryId">
        {(field) => (
          <field.SelectField
            items={items}
            disabled={disabled || categories.length === 0}
            description={
              categories.length === 0
                ? t('rejection-reasons.form.no-categories')
                : missing
                  ? t('rejection-reasons.form.category-unavailable')
                  : undefined
            }
            placeholder={t('rejection-reasons.category-placeholder')}
            label={t('rejection-reasons.category')}
            required
          />
        )}
      </form.AppField>
    );
  },
});
