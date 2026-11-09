import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FacilitySearchPicker,
  FacilitySearchPickerSkeleton,
} from '@/components/pickers/facility-search-picker';

export function RequisitionSearchPicker(
  props: Omit<
    ComponentProps<typeof FacilitySearchPicker>,
    'label' | 'placeholder' | 'clearLabel' | 'emptyMessage'
  >,
) {
  const { t } = useTranslation();
  return (
    <FacilitySearchPicker
      {...props}
      label={t('facility-program.facility')}
      placeholder={t('facility-program.facility-placeholder')}
      clearLabel={t('facility-program.clear-facility')}
      emptyMessage={t('requisitions.view.no-facilities')}
    />
  );
}

export function RequisitionSearchPickerSkeleton() {
  const { t } = useTranslation();
  return <FacilitySearchPickerSkeleton label={t('facility-program.facility')} />;
}
