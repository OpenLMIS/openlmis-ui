import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { fetchProducts, updateProduct } from '@/features/products/api/api';
import { KitUnpackList } from '@/features/products/components/kit-unpack-list';
import type { Product, ProductDetail } from '@/features/products/lib/types';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({
  fetchProducts: vi.fn(),
  updateProduct: vi.fn(),
}));

const product = (id: string, code: string, name: string): Product => ({
  id,
  productCode: code,
  fullProductName: name,
  description: null,
  dispensable: { displayUnit: 'each' },
});

const gloves = product('g1', 'G1', 'Gloves');
const syringe = product('s1', 'S1', 'Syringe');

const kit: ProductDetail = {
  id: 'k1',
  productCode: 'KIT1',
  fullProductName: 'Delivery Kit',
  description: null,
  netContent: 1,
  packRoundingThreshold: 0,
  roundToZero: false,
  dispensable: { dispensingUnit: 'kit' },
  programs: [],
  children: [{ orderable: { id: 'g1' }, quantity: 2 }],
};

const LOADED = { timeout: 3000 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchProducts).mockResolvedValue({
    content: [product('k1', 'KIT1', 'Delivery Kit'), gloves, syringe],
    totalElements: 3,
    totalPages: 1,
    number: 0,
    size: 20,
  });
});

function Kit({ readOnly = false, onDone }: { readOnly?: boolean; onDone: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <WorkspaceSlots>
      <KitUnpackList
        adding={adding}
        kit={kit}
        onAddClose={() => setAdding(false)}
        onAddOpen={() => setAdding(true)}
        onDone={onDone}
        products={[gloves]}
        readOnly={readOnly}
      />
    </WorkspaceSlots>
  );
}

describe('KitUnpackList', () => {
  it('adds a picked product, takes its quantity and saves the kit whole', async () => {
    vi.mocked(updateProduct).mockImplementationOnce(async (_, body) => body);
    const onDone = vi.fn();
    renderPage(<Kit onDone={onDone} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    await user.click(await screen.findByRole('combobox', { name: 'products.kit.products' }));
    expect(
      await screen.findByRole('option', { name: 'S1 - Syringe (each)' }, LOADED),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /KIT1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Gloves/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'S1 - Syringe (each)' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'products.kit.add-picked' }));

    const quantities = await screen.findAllByRole('textbox', { name: 'products.kit.quantity-of' });
    expect(quantities).toHaveLength(2);
    expect(quantities[0]).toHaveValue('2');
    await user.type(quantities[1], '4');
    await user.click(screen.getByRole('button', { name: 'products.kit.save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(updateProduct).toHaveBeenCalledWith('k1', {
      ...kit,
      children: [
        { orderable: { id: 'g1' }, quantity: 2 },
        { orderable: { id: 's1' }, quantity: 4 },
      ],
    });
  });

  it('asks for a quantity before saving, and takes a product out', async () => {
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();
    const table = await screen.findByRole('table');

    await user.clear(within(table).getByRole('textbox', { name: 'products.kit.quantity-of' }));
    await user.click(screen.getByRole('button', { name: 'products.kit.save' }));
    expect(await screen.findByText('products.kit.quantity-required')).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
    const quantity = within(table).getByRole('textbox', { name: 'products.kit.quantity-of' });
    await user.type(quantity, '1');
    await vi.waitFor(() =>
      expect(screen.queryByText('products.kit.quantity-required')).not.toBeInTheDocument(),
    );
    expect(quantity).toHaveAttribute('aria-invalid', 'false');

    await user.click(screen.getByRole('button', { name: 'products.kit.remove' }));
    expect(screen.getByText('products.kit.empty-title')).toBeInTheDocument();
  });

  it('only shows the kit to a user who may not change it', async () => {
    renderPage(<Kit onDone={vi.fn()} readOnly />);

    expect(await screen.findByRole('textbox', { name: 'products.kit.quantity-of' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'products.kit.add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'products.kit.save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.edit.back' })).toBeInTheDocument();
  });
});
