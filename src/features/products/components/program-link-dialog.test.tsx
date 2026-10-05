import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveProductChange } from '@/features/products/api/api';
import { ProgramLinkDialog } from '@/features/products/components/program-link-dialog';
import { RemoveProgramLinkDialog } from '@/features/products/components/remove-program-link-dialog';
import type { ProductDetail } from '@/features/products/lib/types';
import { fetchOrderableDisplayCategories, fetchPrograms } from '@/features/reference-data/api/api';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({ saveProductChange: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchOrderableDisplayCategories: vi.fn(),
}));

const update = vi.fn<(id: string, body: ProductDetail) => Promise<ProductDetail>>();

const familyPlanning = {
  programId: 'fp',
  orderableDisplayCategoryId: 'c1',
  orderableCategoryDisplayName: 'Contraceptives',
  active: true,
  fullSupply: true,
  displayOrder: 6,
  dosesPerPatient: 1,
  pricePerPack: 20.77,
  priceChanges: [],
};

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 28,
  packRoundingThreshold: 0,
  roundToZero: true,
  dispensable: { dispensingUnit: 'each' },
  programs: [familyPlanning],
};

const LOADED = { timeout: 3000 };

beforeEach(() => {
  vi.resetAllMocks();
  update.mockReset();
  vi.mocked(saveProductChange).mockImplementation((id, change) => update(id, change(product)));
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'fp', code: 'PRG001', name: 'Family Planning', active: true },
    { id: 'em', code: 'PRG002', name: 'Essential Meds', active: true },
  ]);
  vi.mocked(fetchOrderableDisplayCategories).mockResolvedValue([
    { id: 'c1', code: 'C1', displayName: 'Contraceptives', displayOrder: 1 },
    { id: 'c2', code: 'C2', displayName: 'Antibiotics', displayOrder: 2 },
  ]);
});

function renderDialog(target: string, { readOnly = false } = {}) {
  const onClose = vi.fn();
  renderPage(
    <ProgramLinkDialog onClose={onClose} product={product} readOnly={readOnly} target={target} />,
  );
  return { onClose };
}

describe('ProgramLinkDialog', () => {
  it('adds a program the product is not in yet, sending the whole product', async () => {
    update.mockImplementationOnce(async (_, body) => body);
    const { onClose } = renderDialog('new');
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('combobox', { name: /products.programs.program/ }, LOADED),
    );
    expect(screen.queryByRole('option', { name: 'Family Planning' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Essential Meds' }));
    await user.click(screen.getByRole('combobox', { name: /products.programs.form.category/ }));
    await user.click(await screen.findByRole('option', { name: 'Antibiotics' }));
    await user.type(screen.getByLabelText(/products.programs.price/), '3.50');
    await user.click(screen.getByRole('button', { name: 'products.programs.form.add' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('o1', {
      ...product,
      programs: [
        familyPlanning,
        {
          programId: 'em',
          active: true,
          fullSupply: false,
          dosesPerPatient: null,
          orderableDisplayCategoryId: 'c2',
          displayOrder: null,
          pricePerPack: 3.5,
        },
      ],
    });
  });

  it('asks for a program and a category before adding', async () => {
    renderDialog('new');
    const user = userEvent.setup();

    await screen.findByRole('combobox', { name: /products.programs.program/ }, LOADED);
    await user.click(screen.getByRole('button', { name: 'products.programs.form.add' }));

    expect(await screen.findByText('products.programs.form.program-required')).toBeInTheDocument();
    expect(screen.getByText('products.programs.form.category-required')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('edits a linked program in place and says why a save failed, keeping the values', async () => {
    const error = httpError(400);
    Object.assign(error.response ?? {}, { data: { message: 'Refused by the server' } });
    update.mockRejectedValueOnce(error);
    const { onClose } = renderDialog('fp');
    const user = userEvent.setup();

    const doses = await screen.findByLabelText(
      /products.programs.form.doses-per-patient/,
      {},
      LOADED,
    );
    expect(doses).toHaveValue('1');
    await user.clear(doses);
    await user.type(doses, '2');
    await user.click(screen.getByRole('button', { name: 'products.programs.form.save' }));

    expect(await screen.findByText('Refused by the server')).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith('o1', {
      ...product,
      programs: [{ ...familyPlanning, dosesPerPatient: 2 }],
    });
    expect(doses).toHaveValue('2');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only shows a linked program to a user who may not change it', async () => {
    renderDialog('fp', { readOnly: true });

    expect(
      await screen.findByLabelText(/products.programs.form.doses-per-patient/, {}, LOADED),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'dialog.close' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.programs.form.save' }),
    ).not.toBeInTheDocument();
  });

  it('says so when the program is no longer linked', async () => {
    renderDialog('gone');

    expect(
      await screen.findByText('products.programs.form.not-found', {}, LOADED),
    ).toBeInTheDocument();
  });
});

describe('RemoveProgramLinkDialog', () => {
  it('takes the program out of the product after asking', async () => {
    update.mockImplementationOnce(async (_, body) => body);
    const onClose = vi.fn();
    renderPage(<RemoveProgramLinkDialog onClose={onClose} product={product} programId="fp" />);
    const user = userEvent.setup();

    expect(
      await screen.findByText('products.programs.remove-description', {}, LOADED),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'products.programs.remove' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('o1', { ...product, programs: [] });
  });
});

describe('RemoveProgramLinkDialog when the server refuses', () => {
  it('says why and stays open, so the user can try again', async () => {
    update.mockRejectedValueOnce(httpError(400, { message: 'Refused by the server' }));
    const onClose = vi.fn();
    renderPage(<RemoveProgramLinkDialog onClose={onClose} product={product} programId="fp" />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'products.programs.remove' }, LOADED),
    );

    expect(
      await screen.findByText('products.programs.remove-error-title', {}, LOADED),
    ).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.programs.remove' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RemoveProgramLinkDialog for a program the product is not in', () => {
  it('names it as not found, with only Close', async () => {
    renderPage(<RemoveProgramLinkDialog onClose={vi.fn()} product={product} programId="gone" />);

    expect(
      await screen.findByRole('alertdialog', { name: 'products.programs.not-found-title' }, LOADED),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.programs.remove' }),
    ).not.toBeInTheDocument();
  });
});

function RemoveFromList() {
  const list = useRef<HTMLElement>(null);
  const [target, setTarget] = useState<string | undefined>('fp');
  return (
    <>
      <section aria-label="Programs" ref={list} tabIndex={-1} />
      <RemoveProgramLinkDialog
        afterRemove={list}
        onClose={() => setTarget(undefined)}
        product={product}
        programId={target}
      />
    </>
  );
}

describe('RemoveProgramLinkDialog after removing', () => {
  it('leaves focus on the list, since the removed row is gone', async () => {
    update.mockImplementationOnce(async (_, body) => body);
    renderPage(<RemoveFromList />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'products.programs.remove' }, LOADED),
    );

    await vi.waitFor(() => expect(screen.getByRole('region', { name: 'Programs' })).toHaveFocus());
  });
});

describe('RemoveProgramLinkDialog when the programs cannot load', () => {
  it('says so and offers Try Again, never a program id as its name', async () => {
    vi.mocked(fetchPrograms).mockRejectedValue(new Error('down'));
    renderPage(<RemoveProgramLinkDialog onClose={vi.fn()} product={product} programId="fp" />, {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });

    expect(
      await screen.findByRole('button', { name: 'error.try-again' }, LOADED),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fp/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.programs.remove' }),
    ).not.toBeInTheDocument();
  });
});
