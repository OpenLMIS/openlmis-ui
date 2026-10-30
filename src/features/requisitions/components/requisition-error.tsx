import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RecordError } from '@/components/app-shell/record-error';
import { requisitionReturnTarget } from '@/features/requisitions/lib/requisition-return';

const BACK_LABELS = {
  '/requisitions/initiate': 'requisitions.requisition.back-initiate',
  '/requisitions/approve': 'requisitions.requisition.back-approve',
  '/requisitions/view': 'requisitions.requisition.back',
} as const;

export function RequisitionError({ search, ...props }: ErrorComponentProps & { search: unknown }) {
  const { t } = useTranslation();
  const router = useRouter();
  const target = requisitionReturnTarget(router.state.location.state, search);
  return (
    <RecordError
      {...props}
      width="wide"
      backLink={<Link {...target} />}
      labels={{
        back: t(BACK_LABELS[target.to]),
        title: t('requisitions.requisition.error-title'),
        description: t('requisitions.requisition.error-description'),
        notFoundTitle: t('requisitions.requisition.not-found-title'),
        notFoundDescription: t('requisitions.requisition.not-found-description'),
      }}
    />
  );
}
