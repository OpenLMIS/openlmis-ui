import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProducts } from '@/features/products/api/api';
import { ProductsTable } from '@/features/products/components/products-table';
import type { ProductsSearch } from '@/features/products/lib/search';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({ fetchProducts: vi.fn() }));

const search: ProductsSearch = { q: 'lev', page: 2 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchProducts).mockResolvedValue({
    content: [
      {
        id: 'o1',
        productCode: 'C100',
        fullProductName: 'Levora',
        description: null,
        dispensable: { displayUnit: 'each' },
      },
    ],
    totalElements: 21,
    totalPages: 2,
    number: 1,
    size: 20,
  });
});

describe('ProductsTable', () => {
  it("opens a product's General tab from its row menu, keeping the list search", async () => {
    const router = renderPage(
      <ProductsTable columnVisibility={{}} onSearchChange={vi.fn()} search={search} />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.actions-for' }));
    const edit = await screen.findByRole('menuitem', { name: 'products.edit' });
    expect(edit).toHaveAttribute('href', '/administration/products/o1/general');
    await user.click(edit);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/administration/products/o1/general'),
    );
    expect(router.state.location.state.productsListSearch).toEqual(search);
  });
});
