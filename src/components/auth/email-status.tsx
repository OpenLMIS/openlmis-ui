import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

/** Whether a user's email address has been verified, with an icon and a label, never colour alone. */
export function EmailStatus({ verified }: { verified: boolean }) {
  const { t } = useTranslation();
  return verified ? (
    <Badge variant="success">
      <CheckIcon data-icon="inline-start" />
      {t('users.form.email-verified')}
    </Badge>
  ) : (
    <Badge variant="secondary">{t('users.form.email-unverified')}</Badge>
  );
}
