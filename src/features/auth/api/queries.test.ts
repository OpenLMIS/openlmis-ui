import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { rightsOptions } from '@/features/auth/api/queries';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));

describe('rightsOptions', () => {
  it('reads the rights by name', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['USERS_MANAGE', 'REQUISITION_VIEW|f|p']);

    const rights = await new QueryClient().fetchQuery(rightsOptions('ada-id'));

    expect([...rights]).toEqual(['USERS_MANAGE', 'REQUISITION_VIEW']);
  });

  it('holds no rights for no one, without asking the server', async () => {
    const rights = await new QueryClient().fetchQuery(rightsOptions(''));

    expect(rights.size).toBe(0);
    expect(fetchPermissionStrings).not.toHaveBeenCalled();
  });
});
