import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApprovalRemovedError,
  addApproval,
  fetchApproval,
  fetchApprovals,
  removeApproval,
  saveApprovalStock,
} from '@/features/products/api/api';
import { ApprovalDialog } from '@/features/products/components/approval-dialog';
import { RemoveApprovalDialog } from '@/features/products/components/remove-approval-dialog';
import type { Approval, ProductDetail } from '@/features/products/lib/types';
import { fetchFacilityTypes, fetchPrograms } from '@/features/reference-data/api/api';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/products/api/api', async (importOriginal) => ({
  ApprovalRemovedError: (await importOriginal<typeof import('@/features/products/api/api')>())
    .ApprovalRemovedError,
  addApproval: vi.fn(),
  fetchApproval: vi.fn(),
  fetchApprovals: vi.fn(),
  removeApproval: vi.fn(),
  saveApprovalStock: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacilityTypes: vi.fn(),
  fetchPrograms: vi.fn(),
}));

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 28,
  packRoundingThreshold: 0,
  roundToZero: true,
  dispensable: { dispensingUnit: 'each' },
  programs: [{ programId: 'fp' }, { programId: 'em' }],
};

const healthCenter = { id: 'hc', code: 'health_center', name: 'Health Center' };
const hospital = { id: 'dh', code: 'district_hospital', name: 'District Hospital' };
const familyPlanning = { id: 'fp', code: 'PRG001', name: 'Family Planning' };
const essentialMeds = { id: 'em', code: 'PRG002', name: 'Essential Meds' };

const approval: Approval = {
  id: 'a1',
  maxPeriodsOfStock: 3,
  minPeriodsOfStock: 1.5,
  emergencyOrderPoint: 1,
  active: true,
  orderable: { id: 'o1' },
  facilityType: healthCenter,
  program: familyPlanning,
};

const LOADED = { timeout: 3000 };

const refusal = () => httpError(400, { message: 'Refused by the server' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchApprovals).mockResolvedValue([approval]);
  vi.mocked(fetchFacilityTypes).mockResolvedValue(
    [healthCenter, hospital].map((type) => ({
      ...type,
      displayOrder: 1,
      active: true,
      primaryHealthCare: false,
    })),
  );
  vi.mocked(fetchPrograms).mockResolvedValue(
    [familyPlanning, essentialMeds, { id: 'tb', code: 'PRG003', name: 'TB' }].map((program) => ({
      ...program,
      active: true,
    })),
  );
});

function renderDialog(target: string, { readOnly = false } = {}) {
  const onClose = vi.fn();
  renderPage(
    <ApprovalDialog onClose={onClose} product={product} readOnly={readOnly} target={target} />,
  );
  return { onClose };
}

async function pick(label: RegExp, option: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: label }, LOADED));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('ApprovalDialog', () => {
  it('approves another facility type for one of the product programs', async () => {
    vi.mocked(addApproval).mockResolvedValueOnce(approval);
    const { onClose } = renderDialog('new');
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('combobox', { name: /products.approvals.program/ }, LOADED),
    );
    expect(screen.queryByRole('option', { name: 'TB' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Essential Meds' }));
    await pick(/products.approvals.facility-type/, 'District Hospital');
    await user.type(screen.getByLabelText(/products.approvals.max-periods/), '2.5');
    await user.click(screen.getByRole('button', { name: 'products.approvals.form.add' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addApproval).toHaveBeenCalledWith({
      orderableId: 'o1',
      facilityType: expect.objectContaining({ id: 'dh', code: 'district_hospital' }),
      program: expect.objectContaining({ id: 'em', code: 'PRG002' }),
      stock: { maxPeriodsOfStock: 2.5, emergencyOrderPoint: null, minPeriodsOfStock: null },
    });
  });

  it('flags a pair that is already approved before saving', async () => {
    renderDialog('new');
    const user = userEvent.setup();

    await pick(/products.approvals.facility-type/, 'Health Center');
    await pick(/products.approvals.program/, 'Family Planning');
    await user.type(screen.getByLabelText(/products.approvals.max-periods/), '3');
    await user.click(screen.getByRole('button', { name: 'products.approvals.form.add' }));

    expect(
      await screen.findByText('products.approvals.form.duplicate', {}, LOADED),
    ).toBeInTheDocument();
    expect(addApproval).not.toHaveBeenCalled();
  });

  it('reads the approval fresh, keeps the pair and saves only its stock', async () => {
    const latest = { ...approval, maxPeriodsOfStock: 4, meta: { versionNumber: 2 } };
    vi.mocked(fetchApproval).mockResolvedValueOnce(latest);
    vi.mocked(saveApprovalStock).mockResolvedValueOnce(latest);
    const { onClose } = renderDialog('a1');
    const user = userEvent.setup();

    const max = await screen.findByLabelText(/products.approvals.max-periods/, {}, LOADED);
    expect(max).toHaveValue('4');
    expect(
      screen.getByRole('combobox', { name: /products.approvals.facility-type/ }),
    ).toBeDisabled();
    await user.clear(max);
    await user.type(max, '6');
    await user.click(screen.getByRole('button', { name: 'products.approvals.form.save' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchApproval).toHaveBeenCalledWith('a1');
    expect(saveApprovalStock).toHaveBeenCalledWith('a1', {
      maxPeriodsOfStock: 6,
      emergencyOrderPoint: 1,
      minPeriodsOfStock: 1.5,
    });
  });

  it('says so, and stays open, when the approval was removed while it was open', async () => {
    vi.mocked(fetchApproval).mockResolvedValueOnce(approval);
    vi.mocked(saveApprovalStock).mockRejectedValueOnce(new ApprovalRemovedError());
    const { onClose } = renderDialog('a1');
    const user = userEvent.setup();

    await screen.findByLabelText(/products.approvals.max-periods/, {}, LOADED);
    await user.click(screen.getByRole('button', { name: 'products.approvals.form.save' }));

    expect(
      await screen.findByText('products.approvals.form.not-found', {}, LOADED),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says why a save failed and keeps what was typed', async () => {
    vi.mocked(fetchApproval).mockResolvedValueOnce(approval);
    vi.mocked(saveApprovalStock).mockRejectedValueOnce(refusal());
    const { onClose } = renderDialog('a1');
    const user = userEvent.setup();

    const max = await screen.findByLabelText(/products.approvals.max-periods/, {}, LOADED);
    await user.clear(max);
    await user.type(max, '6');
    await user.click(screen.getByRole('button', { name: 'products.approvals.form.save' }));

    expect(
      await screen.findByText('products.approvals.form.save-error-title', {}, LOADED),
    ).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(max).toHaveValue('6');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only shows an approval to a user who may not change it', async () => {
    vi.mocked(fetchApproval).mockResolvedValueOnce(approval);
    renderDialog('a1', { readOnly: true });

    expect(
      await screen.findByLabelText(/products.approvals.max-periods/, {}, LOADED),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'dialog.close' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.approvals.form.save' }),
    ).not.toBeInTheDocument();
  });
});

describe('RemoveApprovalDialog', () => {
  it('removes the approval after asking', async () => {
    vi.mocked(removeApproval).mockResolvedValueOnce({ ...approval, active: false });
    const onClose = vi.fn();
    renderPage(<RemoveApprovalDialog approvalId="a1" onClose={onClose} product={product} />);
    const user = userEvent.setup();

    expect(
      await screen.findByText('products.approvals.remove-description', {}, LOADED),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'products.approvals.remove' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(removeApproval).toHaveBeenCalledWith('a1');
  });
});

describe('RemoveApprovalDialog when the server refuses', () => {
  it('says why and stays open, so the user can try again', async () => {
    vi.mocked(removeApproval).mockRejectedValueOnce(refusal());
    const onClose = vi.fn();
    renderPage(<RemoveApprovalDialog approvalId="a1" onClose={onClose} product={product} />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'products.approvals.remove' }, LOADED),
    );

    expect(
      await screen.findByText('products.approvals.remove-error-title', {}, LOADED),
    ).toBeInTheDocument();
    expect(screen.getByText('Refused by the server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.approvals.remove' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RemoveApprovalDialog while the approvals load', () => {
  it('waits for them rather than saying the approval is gone', async () => {
    vi.mocked(fetchApprovals).mockReturnValue(new Promise(() => {}));
    renderPage(<RemoveApprovalDialog approvalId="a1" onClose={vi.fn()} product={product} />);

    expect(
      await screen.findByRole('alertdialog', { name: 'products.approvals.remove-pending-title' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('products.approvals.form.not-found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.approvals.remove' })).toBeDisabled();
  });

  it('names a missing approval as not found, with only Close', async () => {
    renderPage(<RemoveApprovalDialog approvalId="gone" onClose={vi.fn()} product={product} />);

    expect(
      await screen.findByRole(
        'alertdialog',
        { name: 'products.approvals.not-found-title' },
        LOADED,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.approvals.remove' }),
    ).not.toBeInTheDocument();
  });
});
