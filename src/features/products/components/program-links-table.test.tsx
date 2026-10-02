import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgramLinksTable } from '@/features/products/components/program-links-table';
import type { ProductDetail } from '@/features/products/lib/types';
import { fetchOrderableDisplayCategories, fetchPrograms } from '@/features/reference-data/api/api';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchOrderableDisplayCategories: vi.fn(),
}));

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 1,
  packRoundingThreshold: 0,
  roundToZero: false,
  dispensable: { dispensingUnit: 'each' },
  programs: [{ programId: 'fp', orderableDisplayCategoryId: 'c2', active: true }],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'fp', code: 'PRG001', name: 'Family Planning', active: true },
  ]);
  vi.mocked(fetchOrderableDisplayCategories).mockResolvedValue([
    { id: 'c2', code: 'C2', displayName: 'Antibiotics', displayOrder: 2 },
  ]);
});

describe('ProgramLinksTable', () => {
  it('names each link by its category, even when the saved link lacks the name', async () => {
    renderPage(
      <ProgramLinksTable
        canEdit
        columnVisibility={{}}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        product={product}
      />,
    );

    expect(await screen.findByText('Family Planning', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Antibiotics')).toBeInTheDocument();
  });
});
