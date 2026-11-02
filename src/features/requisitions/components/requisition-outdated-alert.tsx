import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function RequisitionOutdatedAlert({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <Alert variant="warning">
      <AlertTitle>
        {label ? `${label}: ` : ''}
        {t('requisitions.edit.outdated-title')}
      </AlertTitle>
      <AlertDescription>{t('requisitions.edit.outdated-description')}</AlertDescription>
      <AlertAction>{children}</AlertAction>
    </Alert>
  );
}
