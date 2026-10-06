import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { saveProductChange } from '@/features/products/api/api';
import { KitUnpackList } from '@/features/products/components/kit-unpack-list';
import type { Product, ProductDetail } from '@/features/products/lib/types';
import { fetchOrderables } from '@/features/reference-data/api/api';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({
  saveProductChange: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchOrderables: vi.fn(),
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
  vi.mocked(fetchOrderables).mockResolvedValue({
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
    const dialog = await screen.findByRole('dialog');
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select S1 - Syringe (each)' }),
    );
    expect(
      within(dialog).getByRole('checkbox', { name: 'Select KIT1 - Delivery Kit (each)' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByText('products.kit.this-kit')).toBeInTheDocument();
    const inKit = within(dialog).getByRole('checkbox', { name: 'Select G1 - Gloves (each)' });
    expect(inKit).toHaveAttribute('aria-disabled', 'true');
    expect(inKit).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'products.kit.add-picked' }));

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

describe('KitUnpackList add products', () => {
  it('filters by name and code as the separate filters legacy has, a page at a time', async () => {
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'products.kit.search-name' }),
      'syr',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'products.kit.search-code' }),
      'S1',
    );

    await waitFor(() =>
      expect(fetchOrderables).toHaveBeenLastCalledWith({
        name: 'syr',
        code: 'S1',
        page: 0,
        size: 10,
      }),
    );
  });

  it('searches on Enter in a filter, never closing the dialog', async () => {
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select S1 - Syringe (each)' }),
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'products.kit.search-code' }),
      'S{Enter}',
    );

    await waitFor(() =>
      expect(fetchOrderables).toHaveBeenLastCalledWith({ name: '', code: 'S', page: 0, size: 10 }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the products picked on one page while the user moves to another', async () => {
    const pages = [[syringe], [product('t1', 'T1', 'Tape')]];
    vi.mocked(fetchOrderables).mockImplementation(async ({ page = 0 }) => ({
      content: pages[page] ?? [],
      totalElements: 11,
      totalPages: 2,
      number: page,
      size: 10,
    }));
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select S1 - Syringe (each)' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Next Page' }));
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select T1 - Tape (each)' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'products.kit.add-picked' }));

    expect(
      await screen.findAllByRole('textbox', { name: 'products.kit.quantity-of' }),
    ).toHaveLength(3);
  });

  it('says so when no product matches the filters', async () => {
    vi.mocked(fetchOrderables).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 10,
    });
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));

    expect(await screen.findByText('products.kit.search-empty')).toBeInTheDocument();
  });

  it('turns paging off while a narrowed filter loads', async () => {
    let answer: (page: Awaited<ReturnType<typeof fetchOrderables>>) => void = () => {};
    vi.mocked(fetchOrderables).mockImplementation(({ name }) =>
      name
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve({
            content: [syringe],
            totalElements: 11,
            totalPages: 2,
            number: 0,
            size: 10,
          }),
    );
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    const next = await within(dialog).findByRole('button', { name: 'Next Page' });
    expect(next).toBeEnabled();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'products.kit.search-name' }),
      'tape',
    );

    await waitFor(() => expect(next).toBeDisabled());
    answer({
      content: [product('t1', 'T1', 'Tape')],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    });
    expect(await within(dialog).findByText('Tape')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it('says so when reloading a page fails, rather than showing the old rows', async () => {
    let firstPageCalls = 0;
    vi.mocked(fetchOrderables).mockImplementation(async ({ page = 0 }) => {
      if (page === 0 && ++firstPageCalls > 1) throw httpError(500);
      return {
        content: [page ? gloves : syringe],
        totalElements: 11,
        totalPages: 2,
        number: page,
        size: 10,
      };
    });
    renderPage(<Kit onDone={vi.fn()} />, {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Next Page' }));
    await within(dialog).findByText('Gloves');
    await user.click(within(dialog).getByRole('button', { name: 'Previous Page' }));

    expect(await within(dialog).findByText('products.kit.search-error-title')).toBeInTheDocument();
    expect(within(dialog).queryByText('Syringe')).not.toBeInTheDocument();
  });

  it('asks for a connection when the search cannot reach the server', async () => {
    vi.mocked(fetchOrderables).mockRejectedValue(networkError());
    renderPage(<Kit onDone={vi.fn()} />, {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));

    expect(
      await within(await screen.findByRole('dialog')).findByText('offline.notice-title'),
    ).toBeInTheDocument();
  });

  it('adds nothing once the only pick is unticked', async () => {
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    const syringeBox = await within(dialog).findByRole('checkbox', {
      name: 'Select S1 - Syringe (each)',
    });
    await user.click(syringeBox);
    await user.click(syringeBox);

    expect(within(dialog).getByRole('button', { name: 'products.kit.add-picked' })).toBeDisabled();
  });

  it('keeps a pick when the filter no longer lists it', async () => {
    const tape = product('t1', 'T1', 'Tape');
    vi.mocked(fetchOrderables).mockImplementation(async ({ name }) => ({
      content: name ? [tape] : [syringe],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    }));
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select S1 - Syringe (each)' }),
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'products.kit.search-name' }),
      'tape',
    );
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select T1 - Tape (each)' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'products.kit.add-picked' }));

    expect(
      await screen.findAllByRole('textbox', { name: 'products.kit.quantity-of' }),
    ).toHaveLength(3);
  });

  it('adds the picks once when Add is clicked twice', async () => {
    renderPage(<Kit onDone={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.kit.add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Select S1 - Syringe (each)' }),
    );
    await user.dblClick(within(dialog).getByRole('button', { name: 'products.kit.add-picked' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByRole('textbox', { name: 'products.kit.quantity-of' })).toHaveLength(2);
  });
});
