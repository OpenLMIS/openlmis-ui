import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deleteAssignments } from '@/components/valid-assignments/delete-assignments';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { saveReason } from '@/features/reasons/lib/save-reason';
import { deleteValidDestination } from '@/features/valid-destinations/api/api';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { client } from '@/integrations/axios';

const ada = { referenceDataUserId: 'ada', username: 'ada', accessToken: 'ada-token' };
const alan = { referenceDataUserId: 'alan', username: 'alan', accessToken: 'alan-token' };
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: 0 } } })}>
    {children}
  </QueryClientProvider>
);
beforeEach(() => useLoginData.getState().setLoginData(ada));
afterEach(() => {
  client.defaults.adapter = undefined;
});

it('does not delete queued selected rows as the next user after the first batch is held across a switch', async () => {
  const sent: { path: string | undefined; token: unknown }[] = [];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  client.defaults.adapter = async (config) => {
    sent.push({ path: config.url, token: config.headers.Authorization });
    if (config.headers.Authorization === 'Bearer ada-token') await hold;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  const { result, unmount } = renderHook(
    () =>
      useSessionMutation({
        mutationFn: (ids: string[]) => deleteAssignments(deleteValidDestination, ids),
      }),
    { wrapper },
  );
  const saving = result.current
    .mutateAsync(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'])
    .catch((error) => error);
  await waitFor(() => expect(sent).toHaveLength(5));
  act(() => useLoginData.getState().setLoginData(alan));
  unmount();
  release();
  expect(await saving).toBeInstanceOf(SessionEndedError);
  expect(sent).toHaveLength(5);
  expect(sent.filter((s) => s.token === 'Bearer alan-token')).toEqual([]);
});

it('does not add pairs from the old reason draft after its deletion is held across a switch', async () => {
  const sent: {
    method: string | undefined;
    path: string | undefined;
    token: unknown;
    body: unknown;
  }[] = [];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  client.defaults.adapter = async (config) => {
    sent.push({
      method: config.method,
      path: config.url,
      token: config.headers.Authorization,
      body: config.data,
    });
    if (config.method === 'delete') await hold;
    const data =
      config.url === '/stockCardLineItemReasons/r1'
        ? { id: 'r1' }
        : config.method === 'post'
          ? { id: 'new', ...(JSON.parse(config.data) as Record<string, unknown>) }
          : {};
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const { result, unmount } = renderHook(
    () =>
      useSessionMutation({
        mutationFn: () =>
          saveReason({
            id: 'r1',
            body: {
              name: 'Damage',
              reasonType: 'DEBIT',
              reasonCategory: 'ADJUSTMENT',
              isFreeTextAllowed: false,
              tags: [],
            },
            savedPairs: [
              {
                id: 'v1',
                program: { id: 'p1' },
                facilityType: { id: 't1' },
                reason: { id: 'r1' },
                hidden: false,
              },
            ],
            pairs: [{ programId: 'p2', facilityTypeId: 't2', show: true }],
          }),
      }),
    { wrapper },
  );
  const saving = result.current.mutateAsync().catch((error) => error);
  await waitFor(() => expect(sent.some((s) => s.method === 'delete')).toBe(true));
  act(() => useLoginData.getState().setLoginData(alan));
  unmount();
  release();
  expect(await saving).toBeInstanceOf(SessionEndedError);
  expect(sent.map((request) => request.method)).toEqual(['put', 'delete']);
  expect(sent.filter((s) => s.token === 'Bearer alan-token')).toEqual([]);
});
