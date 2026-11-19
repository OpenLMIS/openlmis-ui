import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';

export function ProfileContactError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();

  return (
    <ListError
      description={t('profile.error-description')}
      error={error}
      reset={reset}
      title={t('profile.error-title')}
    />
  );
}
