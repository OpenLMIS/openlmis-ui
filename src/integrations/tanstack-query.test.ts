import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { queryClient, shouldRetry } from '@/integrations/tanstack-query';
import { httpError, networkError } from '@/tests/http-error';

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
    expect(shouldRetry(0, httpError(500))).toBe(true);
    expect(shouldRetry(0, new Error('Network Error'))).toBe(true);
    expect(shouldRetry(1, httpError(500))).toBe(false);
  });

  it('never retries a refusal, since asking again gets the same answer', () => {
    expect(shouldRetry(0, httpError(401))).toBe(false);
    expect(shouldRetry(0, httpError(403))).toBe(false);
  });
});

describe('offline', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('fails a request made offline at once, rather than waiting for the network', async () => {
    onlineManager.setOnline(false);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['offline'],
        queryFn: () => Promise.reject(networkError()),
      }),
    ).rejects.toThrow('Network Error');
  });

  it('does not retry an offline failure while still offline', () => {
    onlineManager.setOnline(false);

    expect(shouldRetry(0, networkError())).toBe(false);
  });

  it('retries a network failure once when the browser thinks it is online', () => {
    expect(shouldRetry(0, networkError())).toBe(true);
  });
});
