import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProduct } from '@/features/products/api/api';
import { AddProductDialog } from '@/features/products/components/add-product-dialog';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', () => ({
  createProduct: vi.fn(),
}));

const create = vi.mocked(createProduct);

function refusal(messageKey: string) {
  const error = httpError(400);
  Object.assign(error.response ?? {}, { data: { messageKey, message: 'Refused by the server' } });
  return error;
}

beforeEach(() => {
  vi.resetAllMocks();
});

async function fillAndAdd(code = 'C100') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/products.form.code/), code);
  await user.type(screen.getByLabelText(/products.form.dispensing-unit/), 'each');
  await user.type(screen.getByLabelText(/products.form.net-content/), '10');
  await user.type(screen.getByLabelText(/products.form.pack-rounding-threshold/), '5');
  await user.click(screen.getByRole('button', { name: 'products.form.create' }));
}

describe('AddProductDialog', () => {
  it('creates the product and opens it', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    create.mockResolvedValueOnce({
      id: 'o1',
      productCode: 'C100',
      fullProductName: null,
      description: null,
    });
    renderPage(<AddProductDialog onClose={onClose} onCreated={onCreated} open />);

    await fillAndAdd();

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith('o1'));
    expect(onClose).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      productCode: 'C100',
      fullProductName: undefined,
      description: undefined,
      dispensable: { dispensingUnit: 'each' },
      netContent: 10,
      packRoundingThreshold: 5,
      roundToZero: false,
    });
  });

  it('shows a code the server found in use on the code field, and stays open', async () => {
    const onCreated = vi.fn();
    create.mockRejectedValueOnce(refusal('referenceData.error.orderable.productCode.mustBeUnique'));
    renderPage(<AddProductDialog onClose={vi.fn()} onCreated={onCreated} open />);

    await fillAndAdd();

    expect(await screen.findByText('products.form.code-taken')).toBeInTheDocument();
    expect(screen.queryByText('products.form.save-error-title')).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('says why a save failed for any other reason and keeps what was typed', async () => {
    create.mockRejectedValueOnce(refusal('referenceData.error.orderable.dispensable.invalid'));
    renderPage(<AddProductDialog onClose={vi.fn()} onCreated={vi.fn()} open />);

    await fillAndAdd();

    expect(await screen.findByText('products.form.save-error-title')).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(screen.getByLabelText(/products.form.code/)).toHaveValue('C100');
  });
});
