import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useReloadForUser } from '@/hooks/use-reload-for-user';

const invalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }));

const KEY = ['records', 'detail', 'r1'] as const;

function setup(loadedUserId: string | null) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(KEY, { id: 'r1' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useReloadForUser(loadedUserId, KEY), { wrapper }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'user1' });
});
afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

describe('useReloadForUser', () => {
  it('keeps a page loaded for the signed-in user', () => {
    const { queryClient, result } = setup('user1');

    expect(result.current).toBe('user1');
    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(KEY)).toEqual({ id: 'r1' });
  });

  it('drops the record and reloads when the page was loaded for someone else', () => {
    const { queryClient } = setup('user2');

    expect(invalidate).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(KEY)).toBeUndefined();
  });

  it('reloads when the signed-in user changes', () => {
    const { result } = setup('user1');

    act(() => useLoginData.setState({ referenceDataUserId: 'user2' }));

    expect(result.current).toBe('user2');
    expect(invalidate).toHaveBeenCalledOnce();
  });
});
