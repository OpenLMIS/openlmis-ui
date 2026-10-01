import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPage } from '@/components/auth-card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { useAppName } from '@/lib/app-configuration';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const appName = useAppName();

  return (
    <AuthPage>
      <title>{`${t('forgot-password.title')} - ${appName}`}</title>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
