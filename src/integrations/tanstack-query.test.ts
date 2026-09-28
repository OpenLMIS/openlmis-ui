import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { queryClient, shouldRetry } from '@/integrations/tanstack-query';

const failed = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

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

describe('shouldRetry', () => {
  it('retries a failed request once', () => {
    expect(shouldRetry(0, failed(500))).toBe(true);
    expect(shouldRetry(0, new Error('Network Error'))).toBe(true);
    expect(shouldRetry(1, failed(500))).toBe(false);
  });

  it('never retries a refusal, since asking again gets the same answer', () => {
    expect(shouldRetry(0, failed(401))).toBe(false);
    expect(shouldRetry(0, failed(403))).toBe(false);
  });
});
