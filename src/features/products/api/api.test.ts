import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApprovalRemovedError,
  addApproval,
  createProduct,
  fetchApproval,
  fetchApprovals,
  fetchProduct,
  fetchProducts,
  fetchProductsByIds,
  removeApproval,
  saveApprovalStock,
  saveProductChange,
  updateApproval,
} from '@/features/products/api/api';
import type { Approval } from '@/features/products/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const put = vi.mocked(client.put);
const post = vi.mocked(client.post);

const product = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Acetylsalicylic Acid',
  description: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchProducts', () => {
  it('asks for one page of products, filtered and sorted on the server', async () => {
    const page = { content: [product], totalElements: 1, totalPages: 1, number: 0, size: 10 };
    get.mockResolvedValueOnce({ data: page });

    const query = {
      page: 2,
      size: 20,
      sort: 'fullProductName,asc',
      q: '0363',
      program: 'PRG002',
    };
    await expect(fetchProducts(query)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith('/orderables', { params: query });
  });
});

describe('createProduct', () => {
  it('creates the product with a PUT and no id, as the server has no POST', async () => {
    put.mockResolvedValueOnce({ data: product });
    const body = {
      productCode: 'C100',
      fullProductName: 'Acetylsalicylic Acid',
      dispensable: { dispensingUnit: 'each' },
      netContent: 10,
      packRoundingThreshold: 5,
      roundToZero: false,
    };

    await expect(createProduct(body)).resolves.toEqual(product);
    expect(put).toHaveBeenCalledWith('/orderables', body);
  });
});

describe('fetchProduct', () => {
  it('reads the latest version of one product', async () => {
    get.mockResolvedValueOnce({ data: product });

    await expect(fetchProduct('o1')).resolves.toEqual(product);
    expect(get).toHaveBeenCalledWith('/orderables/o1');
  });
});

const approval: Approval = {
  id: 'a1',
  maxPeriodsOfStock: 3,
  minPeriodsOfStock: 1.5,
  emergencyOrderPoint: 1,
  active: true,
  orderable: { id: 'o1' },
  program: { id: 'fp', code: 'PRG001', name: 'Family Planning' },
  facilityType: { id: 'hc', code: 'health_center', name: 'Health Center' },
  meta: { versionNumber: 2 },
};

describe('fetchApprovals', () => {
  it('lists the active approvals of one product, all on one page', async () => {
    get.mockResolvedValueOnce({ data: { content: [approval], totalElements: 1 } });

    await expect(fetchApprovals('o1')).resolves.toEqual([approval]);
    expect(get).toHaveBeenCalledWith('/facilityTypeApprovedProducts', {
      params: { orderableId: 'o1' },
    });
  });
});

describe('fetchApproval', () => {
  it('reads the latest version of one approval', async () => {
    get.mockResolvedValueOnce({ data: approval });

    await expect(fetchApproval('a1')).resolves.toEqual(approval);
    expect(get).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1');
  });
});

describe('updateApproval', () => {
  it('sends the whole approval to its own address', async () => {
    put.mockResolvedValueOnce({ data: approval });

    await updateApproval(approval);
    expect(put).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1', approval);
  });
});

describe('addApproval', () => {
  const added = {
    orderableId: 'o1',
    facilityType: approval.facilityType,
    program: approval.program,
    stock: { maxPeriodsOfStock: 4, minPeriodsOfStock: null, emergencyOrderPoint: 2 },
  };

  it('brings back a removed approval of the same pair, as legacy does', async () => {
    const removed = { ...approval, active: false };
    get.mockResolvedValueOnce({ data: { content: [removed], totalElements: 1 } });
    put.mockResolvedValueOnce({ data: approval });

    await addApproval(added);
    expect(get).toHaveBeenCalledWith('/facilityTypeApprovedProducts', {
      params: {
        orderableId: 'o1',
        facilityType: 'health_center',
        program: 'PRG001',
        active: false,
      },
    });
    expect(put).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1', {
      ...removed,
      ...added.stock,
      active: true,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('creates a new approval when the pair was never approved', async () => {
    get.mockResolvedValueOnce({ data: { content: [], totalElements: 0 } });
    post.mockResolvedValueOnce({ data: approval });

    await addApproval(added);
    expect(post).toHaveBeenCalledWith('/facilityTypeApprovedProducts', {
      orderable: { id: 'o1' },
      facilityType: { id: 'hc' },
      program: { id: 'fp' },
      ...added.stock,
      active: true,
    });
    expect(put).not.toHaveBeenCalled();
  });
});

describe('removeApproval', () => {
  it('switches off the latest version of the approval, as legacy removes it', async () => {
    const latest = { ...approval, maxPeriodsOfStock: 5, meta: { versionNumber: 3 } };
    get.mockResolvedValueOnce({ data: latest });
    put.mockResolvedValueOnce({ data: { ...latest, active: false } });

    await removeApproval('a1');
    expect(get).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1');
    expect(put).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1', {
      ...latest,
      active: false,
    });
  });
});

describe('saveApprovalStock', () => {
  const stock = { maxPeriodsOfStock: 6, minPeriodsOfStock: null, emergencyOrderPoint: 2 };

  it('applies the stock to the latest version of the approval', async () => {
    const latest = { ...approval, meta: { versionNumber: 3 } };
    get.mockResolvedValueOnce({ data: latest });
    put.mockResolvedValueOnce({ data: { ...latest, ...stock } });

    await saveApprovalStock('a1', stock);
    expect(get).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1');
    expect(put).toHaveBeenCalledWith('/facilityTypeApprovedProducts/a1', { ...latest, ...stock });
  });

  it('refuses to bring back an approval removed since the dialog opened', async () => {
    get.mockResolvedValueOnce({ data: { ...approval, active: false } });

    await expect(saveApprovalStock('a1', stock)).rejects.toBeInstanceOf(ApprovalRemovedError);
    expect(put).not.toHaveBeenCalled();
  });
});

describe('fetchProductsByIds', () => {
  it('reads the named products in one request, each id as its own param', async () => {
    get.mockResolvedValueOnce({ data: { content: [product], totalElements: 1 } });

    await expect(fetchProductsByIds(['o1', 'o2'])).resolves.toEqual([product]);
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { id: ['o1', 'o2'] },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there is nothing to name', async () => {
    await expect(fetchProductsByIds([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('saveProductChange', () => {
  it('applies the change to the latest version, so a change saved meanwhile is kept', async () => {
    const latest = { ...product, fullProductName: 'Renamed Meanwhile', programs: [] };
    get.mockResolvedValueOnce({ data: latest });
    put.mockResolvedValueOnce({ data: latest });

    await saveProductChange('o1', (current) => ({ ...current, description: 'New' }));
    expect(get).toHaveBeenCalledWith('/orderables/o1');
    expect(put).toHaveBeenCalledWith('/orderables/o1', { ...latest, description: 'New' });
  });
});
