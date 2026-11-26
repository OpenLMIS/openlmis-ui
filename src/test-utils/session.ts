import { useLoginData } from '@/features/auth/store/login-data';

export function signInForTest(userId: string, username: string) {
  useLoginData.getState().setLoginData({
    referenceDataUserId: userId,
    username,
    accessToken: 'token',
  });
  return () => useLoginData.getState().clearLoginData();
}
