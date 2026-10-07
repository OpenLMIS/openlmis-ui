import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { permissionsOptions, rightsOptions } from '@/features/auth/api/queries';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));

describe('permissionsOptions', () => {
  it('reads the rights by name and the facility and program grants', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['USERS_MANAGE', 'REQUISITION_VIEW|f|p']);

    const permissions = await new QueryClient().fetchQuery(permissionsOptions('ada-id'));

    expect([...permissions.rights]).toEqual(['USERS_MANAGE', 'REQUISITION_VIEW']);
    expect(permissions.grants).toEqual([
      { right: 'REQUISITION_VIEW', facilityId: 'f', programId: 'p' },
    ]);
  });

  it('holds no rights for no one, without asking the server', async () => {
    vi.mocked(fetchPermissionStrings).mockClear();
    const permissions = await new QueryClient().fetchQuery(permissionsOptions(''));

    expect(permissions.rights.size).toBe(0);
    expect(fetchPermissionStrings).not.toHaveBeenCalled();
  });
});

describe('rightsOptions', () => {
  it('shares one request with the grants and gives a component the right names', async () => {
    vi.mocked(fetchPermissionStrings).mockClear();
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['USERS_MANAGE', 'STOCK_CARDS_VIEW|f|p']);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => ({
        rights: useQuery(rightsOptions('ada-id')).data,
        permissions: useQuery(permissionsOptions('ada-id')).data,
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rights).toBeDefined());
    expect([...(result.current.rights ?? [])]).toEqual(['USERS_MANAGE', 'STOCK_CARDS_VIEW']);
    expect(result.current.permissions?.grants).toHaveLength(1);
    expect(fetchPermissionStrings).toHaveBeenCalledTimes(1);
  });
});
