import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FacilitySearchPicker,
  FacilitySearchPickerSkeleton,
} from '@/components/pickers/facility-search-picker';

export function SupplierSearchPicker({
  onDraftChange,
  ...props
}: Omit<
  ComponentProps<typeof FacilitySearchPicker>,
  'label' | 'placeholder' | 'clearLabel' | 'emptyMessage' | 'onDraftChange'
> & { onDraftChange: (facility: string) => void }) {
  const { t } = useTranslation();
  return (
    <FacilitySearchPicker
      {...props}
      onDraftChange={(facility) => onDraftChange(facility ?? '')}
      label={t('orders.view.supplier')}
      placeholder={t('orders.view.supplier-placeholder')}
      clearLabel={t('orders.view.clear-supplier')}
      emptyMessage={t('orders.view.no-suppliers')}
    />
  );
}

export function SupplierSearchPickerSkeleton() {
  const { t } = useTranslation();
  return <FacilitySearchPickerSkeleton label={t('orders.view.supplier')} />;
}
