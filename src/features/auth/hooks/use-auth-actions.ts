import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as authApi from '@/features/auth/api/api';
import type { LoginInput } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';

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
      const { referenceDataUserId, username, access_token } = await authApi.login(credentials);

      setLoginData({ referenceDataUserId, username, accessToken: access_token });
      toast.success(t('auth.login-success'));

      return true;
    } catch (error) {
      console.error('[useAuthActions.login]', error);
      toast.error(t('auth.login-error'));

      return false;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('[useAuthActions.logout]', error);
      toast.error(t('auth.logout-error'));
    } finally {
      // Clear locally even if the call failed, or an offline user stays stuck logged in.
      clearLoginData();
    }
  };

  return { login, logout };
}
