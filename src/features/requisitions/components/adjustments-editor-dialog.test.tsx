import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, expect, it, vi } from 'vitest';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';
import {
  AdjustmentsEditorDialog,
  adjustmentQuantitySchema,
  adjustmentTotal,
  availableAdjustmentReasons,
} from './adjustments-editor-dialog';

const reasons = [
  { reasonId: 'credit', name: 'Found', reasonType: 'CREDIT' as const },
  { reasonId: 'debit', name: 'Lost', reasonType: 'DEBIT' as const },
  { reasonId: 'hidden', reasonType: 'CREDIT' as const, hidden: true },
];
it('excludes hidden and already used reasons without discarding their totals', () => {
  const adjustments = [
    { reasonId: 'credit', quantity: 12 },
    { reasonId: 'debit', quantity: 5 },
  ];
  expect(availableAdjustmentReasons(reasons, adjustments)).toEqual([]);
  expect(adjustmentTotal([...adjustments, { reasonId: 'hidden', quantity: 3 }], reasons)).toBe(10);
  expect(adjustmentTotal(adjustments, reasons)).toBe(7);
  expect(availableAdjustmentReasons(reasons, [])).toEqual(reasons.slice(0, 2));
});
it('requires positive whole quantities within the server integer limit', () => {
  for (const value of ['', '0', '-1', '1.5', '2147483648']) {
    expect(adjustmentQuantitySchema.safeParse(value).success).toBe(false);
  }
  expect(adjustmentQuantitySchema.safeParse('١٢').success).toBe(true);
});

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
it.each([1000, 390])(
  'keeps quantity edits through Update without mutating the record at width %s',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    const reasons = Array.from({ length: 3 }, (_, index) => ({
      reasonId: `r${index}`,
      name: `Reason ${index}`,
      reasonType: 'CREDIT' as const,
    }));
    const stockAdjustments = reasons.map((r) => ({ reasonId: r.reasonId, quantity: 1 }));
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <AdjustmentsEditorDialog
        model={{
          line: { id: 'line', orderable: { id: 'product' }, stockAdjustments },
          product: undefined,
          program: undefined,
          approvedProduct: undefined,
          fullSupply: true,
          categoryName: '',
          categoryOrder: 0,
          productOrder: 0,
        }}
        reasons={reasons}
        unit="DOSES"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    const quantity = within(dialog).getByRole('textbox', { name: 'Reason 2' });
    await user.clear(quantity);
    await user.type(quantity, '8');
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        ...stockAdjustments.slice(0, 2),
        { reasonId: 'r2', quantity: 8 },
      ]),
    );
    expect(stockAdjustments[2]?.quantity).toBe(1);
    await user.click(within(dialog).getByRole('button', { name: 'Remove, Reason 2' }));
    expect(within(dialog).queryByRole('textbox', { name: 'Reason 2' })).not.toBeInTheDocument();
  },
);

it.each([1000, 390])(
  'adds newest first and removes the named reason at width %s',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderPage(
      <AdjustmentsEditorDialog
        model={{
          line: {
            id: 'line',
            orderable: { id: 'product' },
            stockAdjustments: [{ reasonId: 'credit', quantity: 3 }],
          },
          product: undefined,
          program: undefined,
          approvedProduct: undefined,
          fullSupply: true,
          categoryName: '',
          categoryOrder: 0,
          productOrder: 0,
        }}
        reasons={reasons}
        unit="DOSES"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Lost' }));
    await user.type(screen.getByRole('textbox', { name: 'Quantity' }), '2');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const lost = screen.getByRole('textbox', { name: 'Lost' });
    const found = screen.getByRole('textbox', { name: 'Found' });
    expect(lost.compareDocumentPosition(found) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove, Found' }));
    expect(screen.queryByRole('textbox', { name: 'Found' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Lost' })).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ reasonId: 'debit', quantity: 2 }]));
  },
);
