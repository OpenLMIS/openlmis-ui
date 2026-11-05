import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useOfflineCopies } from '@/features/requisitions/hooks/use-offline-copies';
import {
  beginCopy,
  commitCopy,
  removalDecision,
  removeCopy,
} from '@/features/requisitions/lib/offline-copies';

it('refreshes saved markers and local results after removal while the list is unmounted', async () => {
  const userId = crypto.randomUUID();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: userId, username: 'owner', accessToken: 'token' });
  const lease = await beginCopy('r');
  await commitCopy(lease, {
    id: 'r',
    userId,
    formatVersion: 1,
    revision: 0,
    generation: lease.generation,
    fetchedAt: 1,
    summary: {
      id: 'r',
      status: 'AUTHORIZED',
      emergency: false,
      facility: { id: 'f' },
      program: { id: 'p' },
      processingPeriod: { id: 'period' },
    },
    batch: {
      record: {
        id: 'r',
        status: 'AUTHORIZED',
        modifiedDate: 'old',
        facilityName: 'Clinic',
        periodName: 'November',
        requisitionLineItems: [],
      },
      approvalNodes: ['node'],
      requestedIds: ['r'],
      errors: [],
      fetchedAt: 1,
      currency: {
        currencyCode: 'USD',
        currencySymbol: '$',
        currencySymbolSide: 'left',
        currencyDecimalPlaces: 2,
        groupingSize: 3,
        groupingSeparator: ',',
        decimalSeparator: '.',
      },
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const localKey = ['requisition-local-list', 'view', 'device'];
  client.setQueryData(localKey, { content: ['r'] });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const first = renderHook(useOfflineCopies, { wrapper });
  await waitFor(() => expect(first.result.current?.map((copy) => copy.id)).toEqual(['r']));
  first.unmount();
  client.setQueryData(localKey, { content: ['r'] });
  await removeCopy(await removalDecision('r'));
  const second = renderHook(useOfflineCopies, { wrapper });
  try {
    await waitFor(() => expect(second.result.current).toEqual([]));
    expect(client.getQueryState(localKey)?.isInvalidated).toBe(true);
  } finally {
    second.unmount();
    client.clear();
  }
});
