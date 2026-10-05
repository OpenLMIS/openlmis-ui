import { describe, expect, it, vi } from 'vitest';
import { deleteAssignments } from '@/components/valid-assignments/delete-assignments';
import { httpError } from '@/tests/http-error';

const gone = () =>
  httpError(400, { messageKey: 'stockmanagement.error.destination.assignment.notFound' });

describe('deleteAssignments', () => {
  it('deletes every id and reports them all deleted', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);

    await expect(deleteAssignments(remove, ['a', 'b'])).resolves.toEqual({
      deleted: ['a', 'b'],
      failed: [],
    });
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('reports the ones that failed apart from the ones deleted', async () => {
    const refused = httpError(500, {});
    const remove = vi.fn((id: string) =>
      id === 'b' ? Promise.reject(refused) : Promise.resolve(),
    );

    await expect(deleteAssignments(remove, ['a', 'b', 'c'])).resolves.toEqual({
      deleted: ['a', 'c'],
      failed: ['b'],
      error: refused,
    });
  });

  it('keeps the first refusal, so its reason can be shown', async () => {
    const refused = httpError(403, { message: 'You do not have the right.' });
    const remove = vi.fn().mockRejectedValue(refused);

    await expect(deleteAssignments(remove, ['a', 'b'])).resolves.toEqual({
      deleted: [],
      failed: ['a', 'b'],
      error: refused,
    });
  });

  it('counts one someone else already removed as deleted', async () => {
    const remove = vi.fn().mockRejectedValue(gone());

    await expect(deleteAssignments(remove, ['a'])).resolves.toEqual({
      deleted: ['a'],
      failed: [],
    });
  });

  it('counts a source already removed as deleted too', async () => {
    const remove = vi
      .fn()
      .mockRejectedValue(
        httpError(400, { messageKey: 'stockmanagement.error.source.assignment.notFound' }),
      );

    await expect(deleteAssignments(remove, ['a'])).resolves.toEqual({
      deleted: ['a'],
      failed: [],
    });
  });

  it('sends at most five at a time', async () => {
    let running = 0;
    let most = 0;
    const remove = vi.fn(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });

    await deleteAssignments(
      remove,
      Array.from({ length: 12 }, (_, index) => `id-${index}`),
    );
    expect(remove).toHaveBeenCalledTimes(12);
    expect(most).toBe(5);
  });
});
