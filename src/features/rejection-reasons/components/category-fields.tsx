import { useTranslation } from 'react-i18next';
import { withForm } from '@/components/form/form';
import { EMPTY_CATEGORY_FORM } from '@/features/rejection-reasons/lib/category-form';

export const CategoryFields = withForm({
  defaultValues: EMPTY_CATEGORY_FORM,
  props: {} as { disabled?: boolean },
  render: function Render({ form, disabled }) {
    const { t } = useTranslation();
    return (
      <>
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="auto"
              disabled={disabled}
              label={t('rejection-reason-categories.name')}
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
              label={t('rejection-reason-categories.code')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="active">
          {(field) => (
            <field.SwitchField
              disabled={disabled}
              label={t('rejection-reason-categories.active')}
            />
          )}
        </form.AppField>
      </>
    );
  },
});
