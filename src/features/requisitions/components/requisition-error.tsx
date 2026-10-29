import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RecordError } from '@/components/app-shell/record-error';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';

export function RequisitionError({ search, ...props }: ErrorComponentProps & { search: unknown }) {
  const { t } = useTranslation();
  return (
    <RecordError
      {...props}
      width="wide"
      backLink={<Link search={requisitionSearchSchema.parse(search)} to="/requisitions/view" />}
      labels={{
        back: t('requisitions.requisition.back'),
        title: t('requisitions.requisition.error-title'),
        description: t('requisitions.requisition.error-description'),
        notFoundTitle: t('requisitions.requisition.not-found-title'),
        notFoundDescription: t('requisitions.requisition.not-found-description'),
      }}
    />
  );
}
