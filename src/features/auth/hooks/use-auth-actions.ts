import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as authApi from '@/features/auth/api/api';
import { clearLegacySession } from '@/features/auth/lib/legacy-session';
import type { LoginInput } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';
import { isUnauthorized } from '@/lib/http';

type AuthActions = {
  login: (credentials: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
};

// Both resolve rather than throw; failures surface as a toast.
export function useAuthActions(): AuthActions {
  const setLoginData = useLoginData((state) => state.setLoginData);
  const clearLoginData = useLoginData((state) => state.clearLoginData);
  const { t } = useTranslation();

  const login = async (credentials: LoginInput) => {
    try {
      const loginData = authApi.toLoginData(await authApi.login(credentials));
      const { username } = loginData;

      setLoginData(loginData);
      toast.success(t('auth.login-success-title'), {
        description: t('auth.login-success', { username }),
      });

      return true;
    } catch (error) {
      console.error('[useAuthActions.login]', error);
      toast.error(t('auth.login-error-title'), { description: t('auth.login-error') });

      return false;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Refused because the session had already ended, which is what signing out wants anyway.
      if (!isUnauthorized(error)) {
        console.error('[useAuthActions.logout]', error);
        toast.error(t('auth.logout-error-title'), { description: t('auth.logout-error') });
      }
    } finally {
      // Clear locally even if the call failed, or an offline user stays stuck logged in.
      clearLoginData();
      clearLegacySession();
    }
  };

  return { login, logout };
}
