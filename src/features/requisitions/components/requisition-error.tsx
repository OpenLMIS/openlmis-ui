import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RecordError } from '@/components/app-shell/record-error';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';

export function RequisitionError({ search, ...props }: ErrorComponentProps & { search: unknown }) {
  const { t } = useTranslation();
  const router = useRouter();
  const target = router.state.location.state.requisitionReturn ?? {
    to: '/requisitions/view' as const,
    search: requisitionSearchSchema.parse(search),
  };
  return (
    <RecordError
      {...props}
      width="wide"
      backLink={<Link {...target} />}
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
