import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReason,
  createValidReason,
  deleteValidReason,
  updateReason,
} from '@/features/reasons/api/api';
import { saveReason } from '@/features/reasons/lib/save-reason';
import type { ValidReason } from '@/features/reasons/lib/types';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/reasons/api/api', () => ({
  createReason: vi.fn(),
  updateReason: vi.fn(),
  createValidReason: vi.fn(),
  deleteValidReason: vi.fn(),
}));

const body = {
  name: 'Damage',
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: false,
  tags: [],
};
const reason = { id: 'r1', ...body };

const valid = (
  id: string,
  programId: string,
  facilityTypeId: string,
  hidden = false,
): ValidReason => ({
  id,
  program: { id: programId },
  facilityType: { id: facilityTypeId },
  hidden,
  reason: { id: 'r1' },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createReason).mockResolvedValue(reason);
  vi.mocked(updateReason).mockResolvedValue(reason);
  vi.mocked(createValidReason).mockImplementation(async (pair) => ({ id: 'new', ...pair }));
  vi.mocked(deleteValidReason).mockResolvedValue();
});

describe('saveReason', () => {
  it('creates the reason, then adds each pair to it', async () => {
    const result = await saveReason({
      body,
      savedPairs: [],
      pairs: [
        { programId: 'p1', facilityTypeId: 't1', show: true },
        { programId: 'p2', facilityTypeId: 't1', show: false },
      ],
    });

    expect(result.failed).toEqual([]);
    expect(result.reason).toEqual(reason);
    expect(createReason).toHaveBeenCalledWith(body);
    expect(createValidReason).toHaveBeenCalledWith({
      program: { id: 'p1' },
      facilityType: { id: 't1' },
      hidden: false,
      reason: { id: 'r1' },
    });
    expect(createValidReason).toHaveBeenCalledWith({
      program: { id: 'p2' },
      facilityType: { id: 't1' },
      hidden: true,
      reason: { id: 'r1' },
    });
  });

  it('updates a saved reason, removing every replaced pair before adding any', async () => {
    const order: string[] = [];
    vi.mocked(deleteValidReason).mockImplementation(async (id) => {
      await Promise.resolve();
      order.push(`delete ${id}`);
    });
    vi.mocked(createValidReason).mockImplementation(async (pair) => {
      order.push(`add ${pair.program.id}`);
      return { id: 'new', ...pair };
    });

    await saveReason({
      id: 'r1',
      body: reason,
      savedPairs: [valid('v1', 'p1', 't1'), valid('v2', 'p2', 't1')],
      pairs: [
        { programId: 'p1', facilityTypeId: 't1', show: false },
        { programId: 'p3', facilityTypeId: 't1', show: true },
      ],
    });

    expect(updateReason).toHaveBeenCalledWith('r1', reason);
    expect(order).toEqual(['delete v1', 'delete v2', 'add p1', 'add p3']);
  });

  it('counts a pair someone else already removed as removed', async () => {
    vi.mocked(deleteValidReason).mockRejectedValue(
      httpError(400, { messageKey: 'stockmanagement.error.reasonAssignment.notFound' }),
    );

    const result = await saveReason({
      id: 'r1',
      body: reason,
      savedPairs: [valid('v1', 'p1', 't1')],
      pairs: [],
    });

    expect(result.failed).toEqual([]);
  });

  it('reports the pairs that failed, with the first error, and sends the rest', async () => {
    const refused = httpError(400, { message: 'Program not found' });
    vi.mocked(createValidReason).mockImplementation(async (pair) => {
      if (pair.program.id === 'p1') throw refused;
      return { id: 'new', ...pair };
    });
    vi.mocked(deleteValidReason).mockRejectedValue(httpError(500));

    const result = await saveReason({
      id: 'r1',
      body: reason,
      savedPairs: [valid('v9', 'p9', 't9')],
      pairs: [
        { programId: 'p1', facilityTypeId: 't1', show: true },
        { programId: 'p2', facilityTypeId: 't1', show: true },
      ],
    });

    expect(result.failed).toEqual([
      { programId: 'p9', facilityTypeId: 't9' },
      { programId: 'p1', facilityTypeId: 't1' },
    ]);
    expect(createValidReason).toHaveBeenCalledTimes(2);
  });

  it('does not add a replaced pair whose old one could not be removed', async () => {
    vi.mocked(deleteValidReason).mockRejectedValue(httpError(500));

    const result = await saveReason({
      id: 'r1',
      body: reason,
      savedPairs: [valid('v1', 'p1', 't1')],
      pairs: [{ programId: 'p1', facilityTypeId: 't1', show: false }],
    });

    expect(createValidReason).not.toHaveBeenCalled();
    expect(result.failed).toEqual([{ programId: 'p1', facilityTypeId: 't1' }]);
  });

  it('returns the pairs now stored, so the next save only sends what is still missing', async () => {
    vi.mocked(deleteValidReason).mockImplementation(async (id) => {
      if (id === 'v2') throw httpError(500);
    });
    vi.mocked(createValidReason).mockImplementation(async (pair) => {
      if (pair.program.id === 'p4') throw httpError(500);
      return { id: `new-${pair.program.id}`, ...pair };
    });
    const kept = valid('v3', 'p3', 't1');

    const result = await saveReason({
      id: 'r1',
      body: reason,
      savedPairs: [valid('v1', 'p1', 't1'), valid('v2', 'p2', 't1'), kept],
      pairs: [
        { programId: 'p3', facilityTypeId: 't1', show: true },
        { programId: 'p5', facilityTypeId: 't1', show: true },
        { programId: 'p4', facilityTypeId: 't1', show: true },
      ],
    });

    expect(result.pairs).toEqual([
      valid('v2', 'p2', 't1'),
      kept,
      {
        id: 'new-p5',
        program: { id: 'p5' },
        facilityType: { id: 't1' },
        hidden: false,
        reason: { id: 'r1' },
      },
    ]);
  });

  it('sends no pairs when the reason itself is refused', async () => {
    vi.mocked(createReason).mockRejectedValue(httpError(400));

    await expect(
      saveReason({
        body,
        savedPairs: [],
        pairs: [{ programId: 'p1', facilityTypeId: 't1', show: true }],
      }),
    ).rejects.toThrow();
    expect(createValidReason).not.toHaveBeenCalled();
  });
});
