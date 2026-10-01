import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPage } from '@/components/auth-card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <AuthPage title={t('forgot-password.title')}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
