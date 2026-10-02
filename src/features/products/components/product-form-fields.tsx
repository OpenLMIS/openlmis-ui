import { useTranslation } from 'react-i18next';
import { withForm } from '@/components/form/form';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { EMPTY_PRODUCT_FORM } from '@/features/products/lib/product-form';

export const ProductFormFields = withForm({
  defaultValues: EMPTY_PRODUCT_FORM,
  props: {} as { disabled?: boolean; sizeCode?: string | null | undefined },
  render: function Render({ form, disabled, sizeCode }) {
    const { t } = useTranslation();
    return (
      <>
        <form.AppField name="productCode">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="ltr"
              disabled={disabled}
              label={t('products.form.code')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="fullProductName">
          {(field) => (
            <field.TextField
              autoComplete="off"
              disabled={disabled}
              label={t('products.form.name')}
            />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.TextareaField disabled={disabled} label={t('products.form.description')} />
          )}
        </form.AppField>
        <FieldSet>
          <FieldLegend>{t('products.form.pack-size')}</FieldLegend>
          <FieldGroup>
            <form.AppField name="dispensingUnit">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  description={
                    sizeCode
                      ? t('products.form.size-code-description', { sizeCode })
                      : t('products.form.dispensing-unit-description')
                  }
                  disabled={disabled || Boolean(sizeCode)}
                  label={t('products.form.dispensing-unit')}
                  required={!sizeCode}
                />
              )}
            </form.AppField>
            <div className="grid gap-5 @md/field-group:grid-cols-2">
              <form.AppField name="netContent">
                {(field) => (
                  <field.NumberField
                    description={t('products.form.net-content-description')}
                    disabled={disabled}
                    label={t('products.form.net-content')}
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="packRoundingThreshold">
                {(field) => (
                  <field.NumberField
                    description={t('products.form.pack-rounding-threshold-description')}
                    disabled={disabled}
                    label={t('products.form.pack-rounding-threshold')}
                    required
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="roundToZero">
              {(field) => (
                <field.SwitchField
                  description={t('products.form.round-to-zero-description')}
                  disabled={disabled}
                  label={t('products.form.round-to-zero')}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FieldSet>
      </>
    );
  },
});
