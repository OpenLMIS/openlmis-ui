import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import {
  fetchRejectionReasonCategories,
  fetchRejectionReasons,
} from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';
import { assertSessionScope } from '@/lib/session-scope';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));
vi.mock('@/lib/session-scope', () => ({ getSessionScope: () => 1, assertSessionScope: vi.fn() }));

const get = vi.mocked(client.get);
const category = { id: 'c1', name: 'Category', code: 'C', active: null, extraData: { keep: true } };
const reason = {
  id: 'r1',
  name: 'Reason',
  code: 'R',
  active: null,
  rejectionReasonCategory: category,
  extraData: { keep: true },
};

beforeEach(() => vi.resetAllMocks());

for (const { resource, fetch, record, normalized } of [
  {
    resource: 'rejectionReasonCategories',
    fetch: fetchRejectionReasonCategories,
    record: category,
    normalized: { ...category, active: false },
  },
  {
    resource: 'rejectionReasons',
    fetch: fetchRejectionReasons,
    record: reason,
    normalized: {
      ...reason,
      active: false,
      rejectionReasonCategory: { ...category, active: false },
    },
  },
]) {
  describe(resource, () => {
    it('reads the default complete collection without params, preserving fields and normalizing null Active', async () => {
      get.mockResolvedValueOnce({ data: { content: [record], size: 2147483647, totalPages: 1 } });
      await expect(fetch()).resolves.toEqual([normalized]);
      expect(get).toHaveBeenCalledExactlyOnceWith(`/${resource}`);
    });

    it('follows every capped page with the response size before returning the collection', async () => {
      const second = { ...record, id: 'second', active: true };
      const third = { ...record, id: 'third', active: false };
      get.mockResolvedValueOnce({ data: { content: [record], size: 1, totalPages: 3 } });
      get.mockResolvedValueOnce({ data: { content: [second], size: 1, totalPages: 3 } });
      get.mockResolvedValueOnce({ data: { content: [third], size: 1, totalPages: 3 } });
      const result = await fetch();
      expect(result.map((item) => [item.id, item.active])).toEqual([
        [record.id, false],
        ['second', true],
        ['third', false],
      ]);
      expect(get).toHaveBeenNthCalledWith(2, `/${resource}`, { params: { page: 1, size: 1 } });
      expect(get).toHaveBeenNthCalledWith(3, `/${resource}`, { params: { page: 2, size: 1 } });
    });

    it('rejects a failed later page rather than returning a partial collection', async () => {
      const error = new Error('later page failed');
      get.mockResolvedValueOnce({ data: { content: [record], size: 1, totalPages: 2 } });
      get.mockRejectedValueOnce(error);
      await expect(fetch()).rejects.toBe(error);
    });

    it('rejects an in-flight identity change without requesting another page', async () => {
      const gate = Promise.withResolvers<void>();
      get.mockImplementationOnce(async () => {
        await gate.promise;
        return { data: { content: [record], size: 1, totalPages: 2 } };
      });
      const pending = fetch();
      vi.mocked(assertSessionScope).mockImplementation(() => {
        throw new SessionEndedError();
      });
      gate.resolve();
      await expect(pending).rejects.toBeInstanceOf(SessionEndedError);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('rejects a capped response without a usable size instead of issuing an invalid page request', async () => {
      get.mockResolvedValueOnce({ data: { content: [record], size: 0, totalPages: 2 } });
      await expect(fetch()).rejects.toThrow();
      expect(get).toHaveBeenCalledTimes(1);
    });
  });
}
