import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { updateProduct } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import { ProductGeneralForm } from '@/features/products/components/product-general-form';
import type { ProductDetail } from '@/features/products/lib/types';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({
  updateProduct: vi.fn(),
}));

const update = vi.mocked(updateProduct);

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 28,
  packRoundingThreshold: 0,
  roundToZero: true,
  dispensable: { dispensingUnit: 'each', displayUnit: 'each' },
  programs: [{ programId: 'p1' }],
  identifiers: { tradeItem: 't1' },
};

function refusal(messageKey: string) {
  const error = httpError(400);
  Object.assign(error.response ?? {}, { data: { messageKey, message: 'Refused by the server' } });
  return error;
}

function renderForm({ readOnly = false, onDone = vi.fn(), shown = product } = {}) {
  const queryClient = renderPage(
    <WorkspaceSlots>
      <ProductGeneralForm onDone={onDone} product={shown} readOnly={readOnly} />
    </WorkspaceSlots>,
  );
  return { queryClient, onDone };
}

async function rename(name: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText(/products.form.name/);
  await user.clear(field);
  await user.type(field, name);
  await user.click(screen.getByRole('button', { name: 'products.edit.save' }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProductGeneralForm', () => {
  it('saves the whole product with the change, keeps the new version and goes back', async () => {
    const saved = { ...product, fullProductName: 'Levora Plus' };
    update.mockResolvedValueOnce(saved);
    const { queryClient, onDone } = renderForm();

    await rename('Levora Plus');

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('o1', saved);
    expect(queryClient.getQueryData(productDetailOptions('o1').queryKey)).toEqual(saved);
  });

  it('saves a product sized by a size code without asking for a dispensing unit', async () => {
    const vaccine = { ...product, dispensable: { sizeCode: '5 dose', displayUnit: '5 dose' } };
    update.mockResolvedValueOnce(vaccine);
    const { onDone } = renderForm({ shown: vaccine });

    expect(await screen.findByLabelText(/products.form.dispensing-unit/)).not.toBeRequired();
    await rename('BCG');

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('o1', { ...vaccine, fullProductName: 'BCG' });
  });

  it('stays on the page when the user typed more while it saved', async () => {
    let finish: (saved: ProductDetail) => void = () => {};
    update.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { onDone } = renderForm();
    await rename('Levora Plus');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/products.form.name/), ' 2');

    finish({ ...product, fullProductName: 'Levora Plus' });

    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'products.edit.save' })).toBeEnabled(),
    );
    expect(screen.getByLabelText(/products.form.name/)).toHaveValue('Levora Plus 2');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('leaves the user where they went when the save ends after they left', async () => {
    let finish: (saved: ProductDetail) => void = () => {};
    update.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { onDone } = renderForm();
    await rename('Levora Plus');

    cleanup();
    finish({ ...product, fullProductName: 'Levora Plus' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers no save until something changed', async () => {
    renderForm();

    expect(await screen.findByRole('button', { name: 'products.edit.save' })).toBeDisabled();
  });

  it('shows a code the server found in use on the code field, and stays', async () => {
    update.mockRejectedValueOnce(refusal('referenceData.error.orderable.productCode.mustBeUnique'));
    const { onDone } = renderForm();
    const user = userEvent.setup();
    const code = await screen.findByLabelText(/products.form.code/);
    await user.clear(code);
    await user.type(code, 'C200');
    await user.click(screen.getByRole('button', { name: 'products.edit.save' }));

    expect(await screen.findByText('products.form.code-taken')).toBeInTheDocument();
    expect(screen.queryByText('products.form.save-error-title')).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('says why a save failed for any other reason and keeps what was typed', async () => {
    update.mockRejectedValueOnce(refusal('referenceData.error.orderable.dispensable.invalid'));
    renderForm();

    await rename('Levora Plus');

    expect(await screen.findByText('products.form.save-error-title')).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(screen.getByLabelText(/products.form.name/)).toHaveValue('Levora Plus');
  });

  it('only shows the product to a user who may not change it', async () => {
    const { onDone } = renderForm({ readOnly: true });

    expect(await screen.findByLabelText(/products.form.code/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'products.edit.save' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'products.edit.back' }));
    expect(onDone).toHaveBeenCalled();
  });
});
