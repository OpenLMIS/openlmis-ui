import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReason,
  createValidReason,
  deleteValidReason,
  fetchReason,
  fetchReasonCategories,
  fetchReasonTags,
  fetchReasonTypes,
  fetchValidReasons,
  updateReason,
} from '@/features/reasons/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const body = {
  name: 'Damage',
  description: 'Broken in transit',
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: true,
  tags: ['adjustment'],
};
const reason = { id: 'r1', ...body };
const pair = {
  program: { id: 'p1' },
  facilityType: { id: 't1' },
  hidden: false,
  reason: { id: 'r1' },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('reasons', () => {
  it('reads one reason', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: reason });

    await expect(fetchReason('r1')).resolves.toEqual(reason);
    expect(client.get).toHaveBeenCalledWith('/stockCardLineItemReasons/r1');
  });

  it('creates a reason', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: reason, status: 201 });

    await expect(createReason(body)).resolves.toEqual(reason);
    expect(client.post).toHaveBeenCalledWith('/stockCardLineItemReasons', body);
  });

  it('updates a reason with PUT, as legacy does, whatever the API definition says', async () => {
    vi.mocked(client.put).mockResolvedValueOnce({ data: reason });

    await expect(updateReason('r1', reason)).resolves.toEqual(reason);
    expect(client.put).toHaveBeenCalledWith('/stockCardLineItemReasons/r1', reason);
  });
});

describe('reason options', () => {
  it('lists the reason types', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: ['CREDIT', 'DEBIT'] });

    await expect(fetchReasonTypes()).resolves.toEqual(['CREDIT', 'DEBIT']);
    expect(client.get).toHaveBeenCalledWith('/reasonTypes');
  });

  it('lists the reason categories', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: ['TRANSFER', 'ADJUSTMENT'] });

    await expect(fetchReasonCategories()).resolves.toEqual(['TRANSFER', 'ADJUSTMENT']);
    expect(client.get).toHaveBeenCalledWith('/reasonCategories');
  });

  it('lists the tags in use, in alphabetical order', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: ['debit', 'Consumed', 'adjustment'] });

    await expect(fetchReasonTags()).resolves.toEqual(['adjustment', 'Consumed', 'debit']);
    expect(client.get).toHaveBeenCalledWith('/stockCardLineItemReasonTags');
  });
});

describe('valid reasons', () => {
  it("lists one reason's assignments", async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: [{ id: 'v1', ...pair }] });

    await expect(fetchValidReasons('r1')).resolves.toEqual([{ id: 'v1', ...pair }]);
    expect(client.get).toHaveBeenCalledWith('/validReasons', { params: { reason: 'r1' } });
  });

  it('adds an assignment', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: { id: 'v1', ...pair }, status: 201 });

    await createValidReason(pair);
    expect(client.post).toHaveBeenCalledWith('/validReasons', pair);
  });

  it('removes an assignment', async () => {
    vi.mocked(client.delete).mockResolvedValueOnce({ status: 204 });

    await deleteValidReason('v1');
    expect(client.delete).toHaveBeenCalledWith('/validReasons/v1');
  });
});
