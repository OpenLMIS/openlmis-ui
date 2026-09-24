import { beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { queryClient } from '@/integrations/tanstack-query';

const signIn = (referenceDataUserId: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId, username: referenceDataUserId, accessToken: 'token' });

beforeEach(() => {
  useLoginData.getState().clearLoginData();
  queryClient.clear();
});

describe('queryClient', () => {
  it('drops the cache when a different user signs in', () => {
    signIn('ada');
    queryClient.setQueryData(['home', 'approvals'], { total: 7 });

    signIn('alan');

    expect(queryClient.getQueryData(['home', 'approvals'])).toBeUndefined();
  });

  it('drops the cache on sign out', () => {
    signIn('ada');
    queryClient.setQueryData(['home', 'approvals'], { total: 7 });

    useLoginData.getState().clearLoginData();

    expect(queryClient.getQueryData(['home', 'approvals'])).toBeUndefined();
  });

  it('keeps the cache when the same user refreshes their session', () => {
    signIn('ada');
    queryClient.setQueryData(['home', 'approvals'], { total: 7 });

    signIn('ada');

    expect(queryClient.getQueryData(['home', 'approvals'])).toEqual({ total: 7 });
  });
});
