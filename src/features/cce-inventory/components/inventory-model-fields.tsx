import { useStore } from '@tanstack/react-form';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectionProps } from '@/features/cce-inventory/components/inventory-item-sections';
import { equipmentTypes, makeModelLabel, modelsOfType } from '@/features/cce-inventory/lib/catalog';
import { hasFixedPowerModel, POWER_FIELDS } from '@/features/cce-inventory/lib/inventory-item-form';
import type { CatalogItem } from '@/features/cce-inventory/lib/types';

export function ModelFields({ form, catalog }: SectionProps & { catalog: readonly CatalogItem[] }) {
  const { t } = useTranslation();
  const equipmentType = useStore(form.store, (state) => state.values.equipmentType);
  const lockedPower = useRef(false);

  const applyModel = (catalogItemId: string | null) => {
    const fixed = hasFixedPowerModel(catalog, catalogItemId);
    if (fixed === lockedPower.current) return;
    lockedPower.current = fixed;
    for (const name of POWER_FIELDS) form.setFieldValue(name, fixed ? 'NOT_APPLICABLE' : '');
  };

  const typeItems = equipmentTypes(catalog).map((type) => ({ value: type, label: type }));
  const modelItems = equipmentType
    ? modelsOfType(catalog, equipmentType).map((item) => ({
        value: item.id,
        label: makeModelLabel(item),
      }))
    : [];

  return (
    <>
      <form.AppField
        listeners={{
          onChange: ({ value }) => {
            const [only, ...others] = value ? modelsOfType(catalog, value) : [];
            form.setFieldValue('catalogItemId', only && others.length === 0 ? only.id : null);
          },
        }}
        name="equipmentType"
      >
        {(field) => (
          <field.ComboboxField
            clearLabel={t('cce-inventory.form.clear-equipment-type')}
            emptyMessage={t('cce-inventory.form.no-equipment-types')}
            items={typeItems}
            label={t('cce-inventory.form.equipment-type')}
            limit={-1}
            placeholder={t('cce-inventory.form.equipment-type-placeholder')}
            required
          />
        )}
      </form.AppField>
      <form.AppField
        listeners={{ onChange: ({ value }) => applyModel(value) }}
        name="catalogItemId"
      >
        {(field) => (
          <field.ComboboxField
            clearLabel={t('cce-inventory.form.clear-make-model')}
            disabled={!equipmentType}
            emptyMessage={t('cce-inventory.form.no-models')}
            items={modelItems}
            label={t('cce-inventory.form.make-model')}
            limit={-1}
            placeholder={
              equipmentType
                ? t('cce-inventory.form.make-model-placeholder')
                : t('cce-inventory.form.make-model-after-type')
            }
            required
          />
        )}
      </form.AppField>
    </>
  );
}
