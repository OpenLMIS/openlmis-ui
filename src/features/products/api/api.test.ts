import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProduct,
  fetchProduct,
  fetchProducts,
  updateProduct,
} from '@/features/products/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const put = vi.mocked(client.put);

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

describe('updateProduct', () => {
  it('sends the whole product to its own address, which saves a new version', async () => {
    const body = {
      ...product,
      netContent: 10,
      packRoundingThreshold: 0,
      roundToZero: false,
      dispensable: { dispensingUnit: 'each' },
      programs: [{ programId: 'p1' }],
    };
    put.mockResolvedValueOnce({ data: body });

    await expect(updateProduct('o1', body)).resolves.toEqual(body);
    expect(put).toHaveBeenCalledWith('/orderables/o1', body);
  });
});
