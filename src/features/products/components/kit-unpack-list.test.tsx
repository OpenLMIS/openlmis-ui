import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { fetchProducts, saveProductChange } from '@/features/products/api/api';
import { KitUnpackList } from '@/features/products/components/kit-unpack-list';
import type { Product, ProductDetail } from '@/features/products/lib/types';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({
  fetchProducts: vi.fn(),
  saveProductChange: vi.fn(),
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

const updateProduct = vi.fn<(id: string, body: ProductDetail) => Promise<ProductDetail>>();

beforeEach(() => {
  vi.resetAllMocks();
  updateProduct.mockReset();
  vi.mocked(saveProductChange).mockImplementation((id, change) => updateProduct(id, change(kit)));
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
    updateProduct.mockImplementationOnce(async (_, body) => body);
    const onDone = vi.fn();
    renderPage(<Kit onDone={onDone} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    await user.click(await screen.findByRole('combobox', { name: 'products.kit.products' }));
    expect(await screen.findByRole('option', { name: 'S1 - Syringe (each)' })).toBeInTheDocument();
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

    await waitFor(() => expect(onDone).toHaveBeenCalled());
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
    await waitFor(() =>
      expect(screen.queryByText('products.kit.quantity-required')).not.toBeInTheDocument(),
    );
    expect(quantity).toHaveAttribute('aria-invalid', 'false');

    await user.click(screen.getByRole('button', { name: 'products.kit.actions-for' }));
    await user.click(await screen.findByRole('menuitem', { name: 'products.kit.remove' }));
    expect(await screen.findByText('products.kit.empty-title')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'products.kit.add' })).toHaveFocus(),
    );
  });

  it('says why a save failed and keeps the quantities typed', async () => {
    updateProduct.mockRejectedValueOnce(httpError(400, { message: 'Refused by the server' }));
    const onDone = vi.fn();
    renderPage(<Kit onDone={onDone} />);
    const user = userEvent.setup();

    const quantity = await screen.findByRole('textbox', { name: 'products.kit.quantity-of' });
    await user.clear(quantity);
    await user.type(quantity, '5');
    await user.click(screen.getByRole('button', { name: 'products.kit.save' }));

    expect(await screen.findByText('products.kit.save-error-title')).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(quantity).toHaveValue('5');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('only shows the kit to a user who may not change it', async () => {
    renderPage(<Kit onDone={vi.fn()} readOnly />);

    expect(await screen.findByRole('textbox', { name: 'products.kit.quantity-of' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'products.kit.add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'products.kit.save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.edit.back' })).toBeInTheDocument();
  });
});

describe('KitUnpackList search', () => {
  it('says when there are more matches than it lists', async () => {
    vi.mocked(fetchProducts).mockResolvedValue({
      content: [gloves, syringe],
      totalElements: 45,
      totalPages: 3,
      number: 0,
      size: 20,
    });
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));

    expect(await screen.findByText('products.kit.search-more')).toBeInTheDocument();
  });
});
