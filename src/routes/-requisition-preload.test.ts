import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchMinimalFacilities,
  fetchPrograms,
  fetchRoles,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { minimalFacilitiesOptions, userRecordOptions } from '@/features/reference-data/api/queries';
import { parsePermissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import {
  hasRequisitionReferences,
  preloadRequisitionReferences,
} from '@/routes/-requisition-preload';

vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchUserRecord: vi.fn(),
  fetchMinimalFacilities: vi.fn().mockResolvedValue([]),
  fetchPrograms: vi.fn().mockResolvedValue([]),
  fetchRoles: vi.fn().mockResolvedValue([]),
  fetchUserPrograms: vi.fn().mockResolvedValue([]),
}));
beforeEach(() => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'user', username: 'user', accessToken: 'token' });
});
afterEach(() => vi.clearAllMocks());

it.each([
  [RIGHTS.orderCreate, true],
  [RIGHTS.ordersView, false],
])(
  'warms requisition navigation for %s only when its pages are accessible',
  async (right, eligible) => {
    const client = new QueryClient();
    client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([right]));
    client.setQueryData(userRecordOptions('user').queryKey, {
      id: 'user',
      username: 'user',
      firstName: 'Test',
      lastName: 'User',
      active: true,
      roleAssignments: [],
    });
    expect(await hasRequisitionReferences(client, 'user')).toBe(eligible);
    client.clear();
  },
);

it('does not warm page lookups for an unrelated supervision role', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([]));
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: 'user',
    username: 'user',
    firstName: '',
    lastName: '',
    active: true,
    roleAssignments: [{ roleId: 'other', supervisoryNodeId: 'node' }],
  });
  expect(await preloadRequisitionReferences(client, 'user')).toBe(false);
  expect(fetchUserRecord).toHaveBeenCalledWith('user', { connectionStatus: false });
  expect(fetchMinimalFacilities).not.toHaveBeenCalled();
  expect(fetchPrograms).not.toHaveBeenCalled();
  expect(fetchUserPrograms).not.toHaveBeenCalled();
  client.clear();
});

it('does not start or publish reference reads after the identity changes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([RIGHTS.orderCreate]));
  let finish!: (value: []) => void;
  vi.mocked(fetchMinimalFacilities).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: 'user',
    username: 'user',
    firstName: '',
    lastName: '',
    active: true,
    roleAssignments: [],
  });
  const warm = preloadRequisitionReferences(client, 'user');
  const rejected = expect(warm).rejects.toThrow();
  await waitFor(() => expect(fetchMinimalFacilities).toHaveBeenCalledOnce());
  useLoginData.getState().clearLoginData();
  finish([]);
  await rejected;
  expect(client.getQueryData(minimalFacilitiesOptions().queryKey)).toBeUndefined();
  vi.clearAllMocks();
  expect(await preloadRequisitionReferences(client, 'user')).toBe(false);
  expect(fetchUserRecord).not.toHaveBeenCalled();
  client.clear();
});

it.each([RIGHTS.requisitionView, RIGHTS.requisitionApprove, RIGHTS.orderCreate])(
  'warms shared picker references for %s',
  async (right) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([right]));
    vi.mocked(fetchUserRecord).mockResolvedValue({
      id: 'user',
      username: 'user',
      firstName: '',
      lastName: '',
      active: true,
      roleAssignments: [],
    });
    expect(await preloadRequisitionReferences(client, 'user')).toBe(true);
    expect(fetchMinimalFacilities).toHaveBeenCalledOnce();
    expect(fetchPrograms).toHaveBeenCalledOnce();
    expect(fetchRoles).toHaveBeenCalledOnce();
    expect(fetchUserPrograms).toHaveBeenCalledOnce();
    client.clear();
  },
);

it('warms references for requisition view supervision without a direct permission', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([]));
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: 'user',
    username: 'user',
    firstName: '',
    lastName: '',
    active: true,
    roleAssignments: [{ roleId: 'view', supervisoryNodeId: 'node' }],
  });
  vi.mocked(fetchRoles).mockResolvedValueOnce([
    {
      id: 'view',
      name: 'View',
      rights: [{ id: 'view', name: RIGHTS.requisitionView, type: 'SUPERVISION' }],
    },
  ]);
  expect(await preloadRequisitionReferences(client, 'user')).toBe(true);
  expect(fetchMinimalFacilities).toHaveBeenCalledOnce();
  client.clear();
});
