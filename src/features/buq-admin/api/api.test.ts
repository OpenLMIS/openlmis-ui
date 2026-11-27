import { afterEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { updateCatalogRecord } from '@/features/buq-admin/api/api';
import { client } from '@/integrations/axios';
import { getSessionScope, SessionEndedError } from '@/lib/session-scope';

afterEach(() => {
  useLoginData.getState().clearLoginData();
  localStorage.clear();
  vi.restoreAllMocks();
});

it('skips the Source PUT when the session changes during the check read', async () => {
  const login = useLoginData.getState().setLoginData;
  login({ referenceDataUserId: 'first-user', username: 'first', accessToken: 'first-token' });
  const scope = getSessionScope();
  const body = { name: 'Public funding', description: null };
  const record = { id: 'source-id', ...body, editable: true };
  const pendingRead = Promise.withResolvers<{ data: typeof record }>();
  const get = vi.spyOn(client, 'get').mockReturnValue(pendingRead.promise);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: record });

  const save = updateCatalogRecord('sources', record.id, body);
  expect(get).toHaveBeenCalledExactlyOnceWith('/sourcesOfFunds/source-id', {
    sessionScope: scope,
  });
  login({ referenceDataUserId: 'second-user', username: 'second', accessToken: 'second-token' });
  pendingRead.resolve({ data: record });

  await expect(save).rejects.toBeInstanceOf(SessionEndedError);
  expect(put).not.toHaveBeenCalled();
});
