import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthPage } from '@/components/auth-card';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { useAppName } from '@/lib/app-configuration';

export const Route = createFileRoute('/reset-password/$token')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const appName = useAppName();
  const { token } = Route.useParams();

  return (
    <AuthPage>
      <title>{`${t('reset-password.title')} - ${appName}`}</title>
      <ResetPasswordForm token={token} />
    </AuthPage>
  );
}
